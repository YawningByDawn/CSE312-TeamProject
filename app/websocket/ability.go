package websocket

import "math"

// Abilities: each species has one, on its own key, with a cooldown (species.go). A charge is a long dash that hurts the
// first creature it runs into; a stomp hurts everything near and throws it back; a pull hurts everything near and
// drags it in; a spit fires a shot that hurts the first creature it reaches. An ability hurts creatures of any size,
// the ones bigger than its user less the bigger they are (fightBack), and a hurt that empties a creature's hp eats it,
// wherever it is.

const (
	chargeTime  = 0.45 // seconds an ability charge lasts
	shotSpeed   = 720.0
	abilityShow = 0.35 // seconds the views show an ability being used
)

// shot is a spit in flight.
type shot struct {
	id                   int
	by                   *creature
	sp                   int // the species that spat it, for how it looks
	x, y, vx, vy, r, dmg float64
	life                 float64 // seconds before it falls
}

// abilityShare is an ability's damage, as a share of its user's bite: a charge hits hardest, a pull least, for it also
// drags its targets in.
var abilityShare = map[string]float64{charge: 1.1, stomp: 0.85, spit: 0.75, pull: 0.5}

func abilityDamage(c *creature) float64 {
	return c.kind().ATK * abilityShare[c.kind().Ability.Kind] * (1 + levelBonus*float64(c.abilityLv))
}

// reach is how far a stomp or a pull reaches from the middle of its user.
func reach(c *creature) float64 {
	if c.kind().Ability.Kind == pull {
		return c.r()*4 + 60
	}
	return c.r()*2.6 + 40
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
		c.charging, c.chargeHit = chargeTime, false
	case stomp, pull:
		knock := 380.0
		if ab.Kind == pull {
			knock = -340
		}
		for _, o := range a.creatures {
			if hittable(c, o) && math.Hypot(o.x-c.x, o.y-c.y) < reach(c)+o.r() {
				a.hurt(c, o, dmg*against(c, o), knock)
			}
		}
	case spit:
		cos, sin := math.Cos(c.angle), math.Sin(c.angle)
		t := float64(c.tier())
		a.shots = append(a.shots, &shot{
			id: a.id(), by: c, sp: c.sp, dmg: dmg, r: 7 + 1.3*t, life: (600 + 40*t) / shotSpeed,
			x: c.x + cos*(c.r()+6), y: c.y + sin*(c.r()+6), vx: cos * shotSpeed, vy: sin * shotSpeed,
		})
	}
}

// abilities runs the cooldowns, the charges and the shots in flight.
func (a *arena) abilities(dt float64) {
	for _, c := range a.creatures {
		c.abilityCd = max(0, c.abilityCd-dt)
		c.fx = max(0, c.fx-dt)
		c.charging = max(0, c.charging-dt)
		if c.charging == 0 || c.chargeHit || c.dead != nil {
			continue
		}
		for _, o := range a.creatures {
			if hittable(c, o) && math.Hypot(o.x-c.x, o.y-c.y) < c.r()+o.r()+4 {
				c.chargeHit = true
				a.hurt(c, o, abilityDamage(c)*against(c, o), 480)
				break
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
