package websocket

import (
	"math/rand/v2"
	"os"
	"strconv"
	"time"
)

const gracePeriod = 10 * time.Second

type client struct {
	username string
	send     chan []byte
}

type player struct {
	dx, dy     float64   // where they steer, each in [-1, 1]
	boost      bool      // they asked for a boost since the last tick
	ability    bool      // and for their ability
	cr         *creature // theirs in the arena; nil before they first spawn and while they are dead
	died       *death    // how their last creature died; nil until it has
	camX, camY float64   // where their view stays while they are dead
	client     *client   // nil while disconnected
	leftAt     time.Time
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
	ar := newArena(rand.New(rand.NewPCG(uint64(time.Now().UnixNano()), 0x67726f7665)), rate)
	ticker := time.NewTicker(time.Second / time.Duration(rate))
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
			deliver(players, c.username, encodeHello(c.username))
			deliver(players, c.username, ar.world)
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
			case "spawn":
				if p.cr == nil {
					p.cr, p.died = ar.spawn(in.username), nil
				}
			case "boost":
				p.boost = true
			case "ability":
				p.ability = true
			case "evolve":
				if p.cr != nil {
					ar.evolve(p.cr, *in.msg.To)
				}
			case "upgrade":
				if p.cr != nil {
					ar.upgrade(p.cr, in.msg.Stat)
				}
			default:
				lb.handle(in.username, in.msg)
			}
		case <-ticker.C:
			tick(players, lb, ar, 1/float64(rate))
		}
	}
}

// tick steers every player's creature, steps the arena and sends each player their view of it. A player without a
// connection is out of their lobby, and their creature stands still until they come back or the grace period ends.
func tick(players map[string]*player, lb *lobbies, ar *arena, dt float64) {
	for name, p := range players {
		if p.client == nil {
			lb.leave(name)
			if time.Since(p.leftAt) > gracePeriod {
				if p.cr != nil {
					ar.remove(p.cr)
				}
				delete(players, name)
				guests.release(name)
				continue
			}
		}
		if p.cr != nil {
			p.cr.dx, p.cr.dy = p.dx, p.dy
			if p.boost {
				ar.boost(p.cr)
			}
			if p.ability {
				ar.useAbility(p.cr)
			}
		}
		p.boost, p.ability = false, false
	}
	ar.step(dt)
	for name, p := range players {
		if p.cr != nil && p.cr.dead != nil {
			p.died, p.camX, p.camY, p.cr = p.cr.dead, p.cr.x, p.cr.y, nil
		}
		if p.client != nil {
			deliver(players, name, ar.view(viewer{cr: p.cr, died: p.died, camX: p.camX, camY: p.camY, follow: p.cr == nil && p.died == nil}))
		}
	}
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
	return 20
}
