package websocket

import (
	"os"
	"strconv"
	"time"
)

const (
	gracePeriod = 10 * time.Second
	speed       = 100.0 // px a second, whatever the tick rate
)

type client struct {
	username string
	send     chan []byte
}

type player struct {
	x, y, dx, dy float64
	client       *client // nil while disconnected
	leftAt       time.Time
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
	ticker := time.NewTicker(time.Second / time.Duration(rate))
	for {
		select {
		case c := <-joinChan:
			p := players[c.username]
			if p == nil {
				p = &player{x: 400, y: 300}
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
			if host, ok := lb.of[c.username]; ok { // a takeover tab picks up the lobby
				lb.show(lb.byHost[host])
			}
		case c := <-leaveChan:
			if p := players[c.username]; p != nil && p.client == c {
				disconnect(p)
			}
		case in := <-inputChan:
			p := players[in.username]
			if p == nil || p.client == nil {
				continue
			}
			switch in.msg.Type {
			case "game":
				relay(players, in.username, encodeGame(in.username, in.msg.Data))
			case "input":
				p.dx, p.dy = clamp(in.msg.DX), clamp(in.msg.DY)
			default:
				lb.handle(in.username, in.msg)
			}
		case <-ticker.C:
			tick(players, lb, speed/float64(rate))
		}
	}
}

// tick moves everyone and tells them. A player without a connection is out of their lobby.
func tick(players map[string]*player, lb *lobbies, step float64) {
	states := []playerState{}
	for name, p := range players {
		if p.client == nil {
			lb.leave(name)
			if time.Since(p.leftAt) > gracePeriod {
				delete(players, name)
			}
			continue
		}
		p.x += p.dx * step
		p.y += p.dy * step
		states = append(states, playerState{Name: name, X: p.x, Y: p.y})
	}

	relay(players, "", encodeState(states))
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
	p.dx, p.dy = 0, 0
	p.leftAt = time.Now()
}

func clamp(v float64) float64 {
	return max(-1, min(1, v))
}

func tickRate() int {
	if n, err := strconv.Atoi(os.Getenv("TICK_RATE")); err == nil && n > 0 {
		return n
	}
	return 10
}
