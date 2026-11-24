package websocket

import (
	"os"
	"strconv"
	"time"
)

const (
	gracePeriod = 10 * time.Second
	speed       = 5.0
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
	ticker := time.NewTicker(time.Second / time.Duration(tickRate()))
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
		case c := <-leaveChan:
			if p := players[c.username]; p != nil && p.client == c {
				disconnect(p)
			}
		case in := <-inputChan:
			if p := players[in.username]; p != nil && p.client != nil {
				p.dx, p.dy = clamp(in.msg.DX), clamp(in.msg.DY)
			}
		case <-ticker.C:
			tick(players)
		}
	}
}

func tick(players map[string]*player) {
	states := []playerState{}
	for name, p := range players {
		if p.client == nil {
			if time.Since(p.leftAt) > gracePeriod {
				delete(players, name)
			}
			continue
		}
		p.x += p.dx * speed
		p.y += p.dy * speed
		states = append(states, playerState{Name: name, X: p.x, Y: p.y})
	}

	data := encodeState(states)
	for _, p := range players {
		if p.client == nil {
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
	return 20
}
