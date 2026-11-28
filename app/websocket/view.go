package websocket

import (
	"math"
	"strconv"
)

// viewer is what a player's view is about: their creature, or while they have none, where to look.
type viewer struct {
	cr     *creature
	died   *death
	camX   float64
	camY   float64
	follow bool // no creature and no death yet: watch the leader
}

// view is the "state" message for one player: their own numbers, and the creatures, food, shots and eating near them.
// Creatures are [id, x, y, angle, species, hp %, flags, name, skill level]; food [id, x, y, kind]; shots [id, x, y,
// species, skill level];
// eating [0 for food or 1 for a creature, its id, the eater's id].
func (a *arena) view(v viewer) []byte {
	cx, cy, h := v.camX, v.camY, spectatorView
	if v.cr != nil {
		cx, cy, h = v.cr.x, v.cr.y, v.cr.kind().View
	} else if v.follow {
		cx, cy = worldW/3, worldH/2
		if top := leader(a.creatures); top != nil {
			cx, cy = top.x, top.y
		}
	}
	// what a screen can see, with a margin: up to 1.25 views high (a portrait screen) or 2.4 views wide
	halfH, halfW := h*0.625+150, h*1.2+200
	near := func(x, y float64) bool { return math.Abs(x-cx) < halfW && math.Abs(y-cy) < halfH }
	num := func(b []byte, n int) []byte { return strconv.AppendInt(b, int64(n), 10) }

	b := []byte(`{"type":"state","t":`)
	b = strconv.AppendFloat(b, a.clock, 'f', 3, 64)
	b = append(b, `,"x":`...)
	b = num(b, int(cx))
	b = append(b, `,"y":`...)
	b = num(b, int(cy))
	b = append(b, `,"me":`...)
	b = encodeMe(b, v)
	b = append(b, `,"c":[`...)
	first := true
	for _, c := range a.creatures {
		if !near(c.x, c.y) {
			continue
		}
		if !first {
			b = append(b, ',')
		}
		first = false
		b = append(b, '[')
		b = num(b, c.id)
		b = append(b, ',')
		b = num(b, int(math.Round(c.x)))
		b = append(b, ',')
		b = num(b, int(math.Round(c.y)))
		b = append(b, ',')
		b = strconv.AppendFloat(b, c.angle, 'f', 2, 64)
		b = append(b, ',')
		b = num(b, c.sp)
		b = append(b, ',')
		b = num(b, int(math.Ceil(100*max(0, c.hp)/c.maxHP())))
		b = append(b, ',')
		b = num(b, a.flags(c))
		b = append(b, ',')
		b = append(b, c.nameJSON...)
		b = append(b, ',')
		b = num(b, c.abilityLv)
		b = append(b, ']')
	}
	b = append(b, `],"f":[`...)
	first = true
	for _, f := range a.food {
		if !near(f.x, f.y) {
			continue
		}
		if !first {
			b = append(b, ',')
		}
		first = false
		b = append(b, '[')
		b = num(b, f.id)
		b = append(b, ',')
		b = num(b, int(math.Round(f.x)))
		b = append(b, ',')
		b = num(b, int(math.Round(f.y)))
		b = append(b, ',')
		b = num(b, f.kind)
		b = append(b, ']')
	}
	b = append(b, `],"p":[`...)
	first = true
	for _, s := range a.shots {
		if !near(s.x, s.y) {
			continue
		}
		if !first {
			b = append(b, ',')
		}
		first = false
		b = append(b, '[')
		b = num(b, s.id)
		b = append(b, ',')
		b = num(b, int(math.Round(s.x)))
		b = append(b, ',')
		b = num(b, int(math.Round(s.y)))
		b = append(b, ',')
		b = num(b, s.sp)
		b = append(b, ',')
		b = num(b, s.lv)
		b = append(b, ']')
	}
	b = append(b, `],"e":[`...)
	for i, e := range a.eaten {
		if i > 0 {
			b = append(b, ',')
		}
		kind := 1
		if e.food {
			kind = 0
		}
		b = append(b, '[')
		b = num(b, kind)
		b = append(b, ',')
		b = num(b, e.id)
		b = append(b, ',')
		b = num(b, e.by)
		b = append(b, ']')
	}
	b = append(b, `],"lb":`...)
	b = append(b, a.board...)
	return append(b, '}')
}

// flags packs a creature's state for the view: 1 hidden, 2 boosting, 4 a bot, 8 spawn-protected, 16 in water,
// 32 using its ability, 64 charging, 128 hurt just now, 256 its tail bitten just now, 512 burning in lava, 1024 dazed,
// 2048 sliding on ice.
func (a *arena) flags(c *creature) int {
	f := 0
	burning := c.kind().Habitat != air && !c.kind().Fireproof && inside(a.lava, c.x, c.y) != nil
	for i, on := range []bool{c.hidden, c.dash > 0, c.bot != nil, c.guard > 0, c.wet, c.fx > 0, c.charging > 0, a.clock-c.hurtAt < 0.2,
		c.tailBit > 0, burning, c.dazed > 0, a.onIce(c)} {
		if on {
			f |= 1 << i
		}
	}
	return f
}
