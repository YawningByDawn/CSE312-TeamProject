package websocket

import (
	"math"
	"slices"
)

// Abilities: each species has one, on its own key, with a cooldown (species.go). A charge is a long dash that hurts the
// first creature it runs into; a stomp hurts everything near and throws it back; a pull hurts everything near and
// drags it in; a spit fires a shot that hurts the first creature it reaches. An ability hurts creatures of any size,
// the ones bigger than its user less the bigger they are (fightBack), and a hurt that empties a creature's hp eats it,
// wherever it is.
//
// Skills grow with their level (the "ability" stat): a stomp or pull reaches further and throws harder, and from
// level 3 a stomp dazes what it hits; a charge runs longer and goes through more creatures; a spit flies bigger,
// faster and further, and from level 3 it fires three shots in a fan, five at level 5.

const (
	chargeTime  = 0.45 // seconds an ability charge lasts
	shotSpeed   = 720.0
	abilityShow = 0.35 // seconds the views show an ability being used
	dazeTime    = 1.0  // seconds a stomp from level 3 slows what it hits
	dazeSlow    = 0.5  // to this share of its speed
)

// shot is a spit in flight.
type shot struct {
	id                   int
	by                   *creature
	sp, lv               int // the species that spat it and its skill level, for how it looks
	x, y, vx, vy, r, dmg float64
	life                 float64 // seconds before it falls
}

// abilityShare is an ability's damage, as a share of its user's bite: a charge hits hardest, a pull least, for it also
// drags its targets in.
var abilityShare = map[string]float64{charge: 1.1, stomp: 0.85, spit: 0.75, pull: 0.5}

func abilityDamage(c *creature) float64 {
	return c.kind().ATK * abilityShare[c.kind().Ability.Kind] * (1 + levelBonus*float64(c.abilityLv))
}

// grow is how much bigger a skill is at its user's level.
func grow(c *creature, per float64) float64 {
	return 1 + per*float64(c.abilityLv)
}

// reach is how far a stomp or a pull reaches from the middle of its user.
func reach(c *creature) float64 {
	if c.kind().Ability.Kind == pull {
		return (c.r()*4 + 60) * grow(c, 0.12)
	}
	return (c.r()*2.6 + 40) * grow(c, 0.12)
}

// hittable says whether `by`'s ability can hurt o.
func hittable(by, o *creature) bool {
	return o != by && o.dead == nil && !o.hidden && o.guard == 0
}

// useAbility starts a creature's ability, if it is ready. Using it ends spawn protection.
func (a *arena) useAbility(c *creature) {
	if c.dead != nil || c.abilityCd > 0 {
		return
	}
	ab := c.kind().Ability
	c.abilityCd, c.fx, c.guard = ab.Cooldown, abilityShow, 0
	dmg := abilityDamage(c)
	switch ab.Kind {
	case charge:
		c.charging, c.chargeHits = chargeTime*grow(c, 0.1), c.chargeHits[:0]
	case stomp, pull:
		knock := 380 * grow(c, 0.1)
		if ab.Kind == pull {
			knock = -340 * grow(c, 0.1)
		}
		for _, o := range a.creatures {
			if hittable(c, o) && math.Hypot(o.x-c.x, o.y-c.y) < reach(c)+o.r() {
				a.hurt(c, o, dmg*against(c, o), knock)
				if ab.Kind == stomp && c.abilityLv >= 3 {
					o.dazed = dazeTime
				}
			}
		}
	case spit:
		t := float64(c.tier())
		n := 1
		if c.abilityLv >= 5 {
			n = 5
		} else if c.abilityLv >= 3 {
			n = 3
		}
		speed := shotSpeed * grow(c, 0.05)
		for i := range n {
			side := float64(i - n/2)
			ang := c.angle + side*0.16
			share := 1.0
			if side != 0 {
				share = 0.6 // the shots to the sides hurt less
			}
			cos, sin := math.Cos(ang), math.Sin(ang)
			a.shots = append(a.shots, &shot{
				id: a.id(), by: c, sp: c.sp, lv: c.abilityLv, dmg: dmg * share, r: (7 + 1.3*t) * grow(c, 0.12),
				life: (600 + 40*t) * grow(c, 0.1) / speed,
				x:    c.x + cos*(c.r()+6), y: c.y + sin*(c.r()+6), vx: cos * speed, vy: sin * speed,
			})
		}
	}
}

// abilities runs the cooldowns, the charges and the shots in flight.
func (a *arena) abilities(dt float64) {
	for _, c := range a.creatures {
		c.abilityCd = max(0, c.abilityCd-dt)
		c.fx = max(0, c.fx-dt)
		c.charging = max(0, c.charging-dt)
		c.dazed = max(0, c.dazed-dt)
		// a charge goes through creatures, more of them the higher its level
		if c.charging == 0 || c.dead != nil || len(c.chargeHits) > c.abilityLv/2 {
			continue
		}
		for _, o := range a.creatures {
			if hittable(c, o) && !slices.Contains(c.chargeHits, o.id) && math.Hypot(o.x-c.x, o.y-c.y) < c.r()+o.r()+4 {
				c.chargeHits = append(c.chargeHits, o.id)
				a.hurt(c, o, abilityDamage(c)*against(c, o), 480*grow(c, 0.1))
				if len(c.chargeHits) > c.abilityLv/2 {
					break
				}
			}
		}
	}
	live := a.shots[:0]
	for _, s := range a.shots {
		s.x += s.vx * dt
		s.y += s.vy * dt
		s.life -= dt
		hit := false
		for _, o := range a.creatures {
			if hittable(s.by, o) && math.Hypot(o.x-s.x, o.y-s.y) < o.r()+s.r {
				hit = true
				o.vx += s.vx / shotSpeed * 160
				o.vy += s.vy / shotSpeed * 160
				a.hurt(s.by, o, s.dmg*against(s.by, o), 0)
				break
			}
		}
		if !hit && s.life > 0 && s.x > 0 && s.y > 0 && s.x < worldW && s.y < worldH {
			live = append(live, s)
		}
	}
	clear(a.shots[len(live):])
	a.shots = live
}
