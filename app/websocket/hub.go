package websocket

import (
	"os"
	"slices"
	"strconv"
	"strings"
	"time"
)

const (
	gracePeriod     = 10 * time.Second
	defaultTickRate = 20
)

type client struct {
	username string
	send     chan []byte
}

type player struct {
	client *client // nil while disconnected
	leftAt time.Time
}

type input struct {
	username string
	msg      inMessage
}

var (
	joinChan  = make(chan *client)
	leaveChan = make(chan *client)
	inputChan = make(chan input, 256)
)

// RunHub owns all live state. Everything else talks to it through the channels above.
func RunHub() {
	players := map[string]*player{}
	lb := newLobbies(func(to string, data []byte) { deliver(players, to, data) })
	rate := tickRate()
	lb.rate = rate
	ticker := time.NewTicker(time.Second / time.Duration(rate))
	var on []byte // who is on, as last sent
	for {
		select {
		case c := <-joinChan:
			p := players[c.username]
			if p == nil {
				p = &player{}
				players[c.username] = p
			}
			if p.client != nil { // a newer connection replaces the old one
				select {
				case p.client.send <- kickedMessage:
				default:
				}
				close(p.client.send)
			}
			p.client = c
			if on != nil { // who is on; the next tick tells everyone if this player is new
				deliver(players, c.username, on)
			}
			lb.resume(c.username) // a takeover tab picks up the lobby and its match
		case c := <-leaveChan:
			if p := players[c.username]; p != nil && p.client == c {
				disconnect(p)
			}
		case in := <-inputChan:
			p := players[in.username]
			if p == nil || p.client == nil {
				continue
			}
			if in.msg.Type == "game" {
				relay(players, in.username, encodeGame(in.username, in.msg.Data))
			} else {
				lb.handle(in.username, in.msg)
			}
		case <-ticker.C:
			if now := tick(players, lb, 1/float64(rate)); string(now) != string(on) {
				on = now
				relay(players, "", on)
			}
		}
	}
}

// tick runs the matches one step and says who is on. A player without a connection is out of their lobby.
func tick(players map[string]*player, lb *lobbies, dt float64) []byte {
	states := []playerState{}
	for name, p := range players {
		if p.client == nil {
			lb.leave(name)
			if time.Since(p.leftAt) > gracePeriod {
				delete(players, name)
			}
			continue
		}
		states = append(states, playerState{Name: name})
	}
	lb.step(dt)
	slices.SortFunc(states, func(a, b playerState) int { return strings.Compare(a.Name, b.Name) })
	return encodeState(states)
}

// deliver sends data to one connected player.
func deliver(players map[string]*player, to string, data []byte) {
	p := players[to]
	if p == nil || p.client == nil {
		return
	}
	select {
	case p.client.send <- data:
	default:
		disconnect(p) // too far behind to keep up
	}
}

// relay sends data to every connected player but `except`.
func relay(players map[string]*player, except string, data []byte) {
	for name, p := range players {
		if p.client == nil || name == except {
			continue
		}
		select {
		case p.client.send <- data:
		default:
			disconnect(p) // too far behind to keep up
		}
	}
}

// disconnect keeps the player for gracePeriod so a quick reconnect resumes it.
func disconnect(p *player) {
	close(p.client.send)
	p.client = nil
	p.leftAt = time.Now()
}

func clamp(v float64) float64 {
	return max(-1, min(1, v))
}

func tickRate() int {
	if n, err := strconv.Atoi(os.Getenv("TICK_RATE")); err == nil && n > 0 {
		return n
	}
	return defaultTickRate
}
