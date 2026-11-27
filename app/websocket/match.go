package websocket

import (
	"math"
	"math/rand/v2"
	"slices"
)

// A match is a started lobby playing in the shared mine (DECISIONS 133). The hub owns it and steps it every tick; the
// players only send what they want (a heading, a strike) and are sent what is. Each player serves the god of their seat
// (lobby order, the host first), spawns at that god's shrine, and gathers the crystals lying in the open zones: walking
// over one picks it up, standing at their own shrine gives what they carry to their god, and the first god given the
// goal wins. A strike swings the pick at the aim; its blow knocks anyone in reach back, stuns them, and scatters what
// they carry for anyone to take. Nobody is struck at their own shrine.

type mPlayer struct {
	name   string
	seat   int
	x, y   float64
	dx, dy float64 // the held heading, each -1..1
	face   float64 // 1 right, -1 left
	walked float64
	moving bool
	carry  int
	swing  float64 // seconds into a swing, -1 at rest
	ax, ay float64 // the swing's aim, a unit vector
	struck bool    // this swing's blow has landed
	stun   float64 // seconds left stunned
}

type crystal struct {
	id   int
	x, y float64
}

type match struct {
	lay      *layout
	players  []*mPlayer
	crystals []crystal
	next     int
	spawn    float64
	score    []int
	winner   int // the winning seat, -1 while it plays
	over     float64
	seq      int
	rng      *rand.Rand
}

// newMatch seats `members` in order in the mine for that many players, the ground full of crystals.
func newMatch(members []string, rng *rand.Rand) *match {
	lay := &arena.layouts[len(members)-1]
	m := &match{lay: lay, score: make([]int, len(lay.seats)), winner: -1, rng: rng}
	for i, name := range members {
		s := lay.seats[i].Shrine
		m.players = append(m.players, &mPlayer{name: name, seat: i, x: s[0], y: s[1], face: 1, swing: -1})
	}
	for len(m.crystals) < m.capacity() {
		m.grow()
	}
	return m
}

func (m *match) capacity() int {
	return arena.rules.Crystals + arena.rules.CrystalsEach*len(m.lay.seats)
}

func (m *match) player(name string) *mPlayer {
	for _, p := range m.players {
		if p.name == name {
			return p
		}
	}
	return nil
}

// input holds `name`'s heading until the next.
func (m *match) input(name string, dx, dy float64) {
	if p := m.player(name); p != nil {
		p.dx, p.dy = clamp(dx), clamp(dy)
	}
}

// strike starts `name`'s swing toward (dx, dy), or the way they face; one at a time, not while stunned or once won.
func (m *match) strike(name string, dx, dy float64) {
	p := m.player(name)
	if p == nil || p.swing >= 0 || p.stun > 0 || m.winner >= 0 {
		return
	}
	l := math.Hypot(dx, dy)
	if l < 1e-9 {
		dx, dy, l = p.face, 0, 1
	}
	p.ax, p.ay = dx/l, dy/l
	if p.ax != 0 {
		p.face = math.Copysign(1, p.ax)
	}
	p.swing, p.struck = 0, false
}

// remove takes `name` out; what they carried falls where they stood. Their god's score stays.
func (m *match) remove(name string) {
	p := m.player(name)
	if p == nil {
		return
	}
	m.scatter(p)
	m.players = slices.DeleteFunc(m.players, func(q *mPlayer) bool { return q == p })
}

// done: the winner has been shown for the rules' while.
func (m *match) done() bool {
	return m.winner >= 0 && m.over >= arena.rules.Over
}

// step runs dt seconds: swings, stuns, walks, picking up and giving, and new crystals. Once won, nothing moves.
func (m *match) step(dt float64) {
	R := &arena.rules
	m.seq++
	if m.winner >= 0 {
		m.over += dt
		for _, p := range m.players {
			p.moving = false
		}
		return
	}
	for _, p := range m.players {
		p.moving = false
		if p.stun > 0 {
			p.stun = max(0, p.stun-dt)
			continue
		}
		if p.swing >= 0 {
			// a swing holds the feet; its blow lands once, at the clip's own moment
			p.swing += dt
			if !p.struck && p.swing >= R.Blow {
				p.struck = true
				m.blow(p)
			}
			if p.swing >= R.Swing {
				p.swing = -1
			}
			continue
		}
		if l := math.Hypot(p.dx, p.dy); l > 0 {
			step := R.Speed * dt / l
			if d := m.slide(p, p.dx*step, p.dy*step); d > 0 {
				p.walked += d
				p.moving = true
			}
			if p.dx != 0 {
				p.face = math.Copysign(1, p.dx)
			}
		}
		m.gather(p)
		if m.winner >= 0 {
			return
		}
	}
	if len(m.crystals) < m.capacity() {
		if m.spawn += dt; m.spawn >= R.SpawnEvery {
			m.spawn = 0
			m.grow()
		}
	} else {
		m.spawn = 0
	}
}

// slide moves p by (mx, my), or along whichever axis the walls leave open; the distance it went.
func (m *match) slide(p *mPlayer, mx, my float64) float64 {
	switch {
	case m.lay.stands(p.x+mx, p.y+my):
	case mx != 0 && m.lay.stands(p.x+mx, p.y):
		my = 0
	case my != 0 && m.lay.stands(p.x, p.y+my):
		mx = 0
	default:
		return 0
	}
	p.x += mx
	p.y += my
	return math.Hypot(mx, my)
}

// gather: p picks up the crystals in reach while they have room, and at their own shrine gives what they carry.
func (m *match) gather(p *mPlayer) {
	R := &arena.rules
	m.crystals = slices.DeleteFunc(m.crystals, func(c crystal) bool {
		if p.carry >= R.Carry || math.Hypot(c.x-p.x, c.y-p.y) > R.Pick {
			return false
		}
		p.carry++
		return true
	})
	if p.carry > 0 && m.atShrine(p) {
		m.score[p.seat] += p.carry
		p.carry = 0
		if m.score[p.seat] >= R.Goal {
			m.winner = p.seat
		}
	}
}

func (m *match) atShrine(p *mPlayer) bool {
	s := m.lay.seats[p.seat].Shrine
	return math.Hypot(p.x-s[0], p.y-s[1]) <= arena.rules.Shrine
}

// blow lands p's swing on everyone in reach and in the arc of the aim (anyone at the feet always), but the stunned and
// those at their own shrine.
func (m *match) blow(p *mPlayer) {
	R := &arena.rules
	arc := math.Cos(R.Arc * math.Pi / 180)
	for _, q := range m.players {
		if q == p || q.stun > 0 || m.atShrine(q) {
			continue
		}
		vx, vy := q.x-p.x, q.y-p.y
		d := math.Hypot(vx, vy)
		if d > R.Reach+R.Feet || (d > 2*R.Feet && (vx*p.ax+vy*p.ay)/d < arc) {
			continue
		}
		q.stun, q.swing, q.moving = R.Stun, -1, false
		m.scatter(q)
		if d < 1e-9 {
			vx, vy, d = p.ax, p.ay, 1
		}
		// knocked back in short steps, so a wall stops it
		for i, n := 0, int(math.Ceil(R.Knock/4)); i < n; i++ {
			m.slide(q, vx/d*R.Knock/float64(n), vy/d*R.Knock/float64(n))
		}
	}
}

// scatter drops what p carries around them, each on open floor within the rules' reach (at their feet if none is found).
func (m *match) scatter(p *mPlayer) {
	R := &arena.rules
	for range p.carry {
		x, y := p.x, p.y
		for range 10 {
			a, r := m.rng.Float64()*2*math.Pi, R.Feet+m.rng.Float64()*(R.Scatter-R.Feet)
			if cx, cy := p.x+math.Cos(a)*r, p.y+math.Sin(a)*r; m.lay.stands(cx, cy) {
				x, y = cx, cy
				break
			}
		}
		m.drop(x, y)
	}
	p.carry = 0
}

// grow puts a crystal on a spot of the layout no other crystal is near.
func (m *match) grow() {
	g := &arena.ground
	spots := m.lay.spots
	if len(spots) == 0 {
		return
	}
	var x, y float64
	for range 8 {
		c := spots[m.rng.IntN(len(spots))]
		x, y = (float64(c%g.gw)+m.rng.Float64())*g.cell, (float64(c/g.gw)+m.rng.Float64())*g.cell
		if !slices.ContainsFunc(m.crystals, func(k crystal) bool { return math.Hypot(k.x-x, k.y-y) < 3*arena.rules.Pick }) {
			break
		}
	}
	m.drop(x, y)
}

func (m *match) drop(x, y float64) {
	m.next++
	m.crystals = append(m.crystals, crystal{id: m.next, x: x, y: y})
}
