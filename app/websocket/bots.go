package websocket

import "math"

// Bots: they flee what could eat them (into cover, if they fit), chase what they could eat, graze, or wander, and keep
// to where their species gets about. They evolve when they can, but never past botTopTier, so the mythical top of
// the chain is for players; at their cap they stay for stat points instead.

const (
	botTopTier    = 6     // the biggest a bot grows
	botXP         = 0.35  // bots gain xp at this share of the rate players do
	botChaseRange = 280.0 // px between bodies at which a bot starts after prey
	botChaseFor   = 3.5   // seconds a bot keeps after prey before it gives up
	botRestFor    = 2.5   // seconds before it chases again
)

type brain struct {
	mode         int // what it is doing: wandering, grazing, chasing or fleeing
	target       *creature
	goalX, goalY float64
	heading      float64
	rethink      float64 // seconds until it decides again
	chased       float64 // seconds it has spent on this chase
	rest         float64 // seconds until it will chase again, after giving one up
	wary         float64 // how far off it notices danger, as a share of the usual
	bold         float64 // the chance it boosts when it could
	lifespan     float64 // seconds it lives, unless something eats it first
}

const (
	wandering = iota
	grazing
	chasing
	fleeing
)

// think steers a bot: away from what could eat it, after what it could eat, to food, or anywhere it fits.
func (a *arena) think(c *creature, dt float64) {
	b := c.bot
	sp := c.kind()
	if c.offer {
		a.botEvolve(c)
	}
	b.rest = max(0, b.rest-dt)
	if b.mode == chasing {
		if b.chased += dt; b.chased > botChaseFor {
			b.mode, b.target, b.rest, b.rethink = wandering, nil, botRestFor, 0
		}
	} else {
		b.chased = 0
	}
	if b.rethink -= dt; b.rethink <= 0 {
		b.rethink = 0.15 + a.rng.Float64()*0.2
		a.decide(c)
	}
	var tx, ty float64
	switch b.mode {
	case fleeing, chasing:
		t := b.target
		if t == nil || t.dead != nil || (b.mode == chasing && t.hidden) {
			b.mode, b.rethink = wandering, 0
			return
		}
		d := math.Hypot(t.x-c.x, t.y-c.y) - t.r() - sp.R
		if b.mode == chasing {
			tx, ty = t.x+t.vx*0.2-c.x, t.y+t.vy*0.2-c.y
			a.botAttack(c, t, d)
		} else {
			tx, ty = c.x-t.x, c.y-t.y
			if b.goalX != 0 || b.goalY != 0 { // cover to hide in
				tx, ty = b.goalX-c.x, b.goalY-c.y
			}
			perched := climbs(c) && !climbs(t) && (inside(a.rocks, c.x, c.y) != nil || inside(a.reefs, c.x, c.y) != nil)
			if c.hidden || perched {
				tx, ty = 0, 0
			} else if d < 140 && c.abilityCd == 0 && a.rng.Float64() < b.bold*dt*4 {
				switch sp.Ability.Kind {
				case stomp, spit:
					if t.tier() <= c.tier()+1 {
						c.angle = math.Atan2(t.y-c.y, t.x-c.x)
						a.useAbility(c)
					}
				case charge: // a charge away is an escape
					c.angle = math.Atan2(ty, tx)
					a.useAbility(c)
				}
			}
		}
		if d < 90 && a.rng.Float64() < b.bold*dt*6 {
			a.boost(c)
		}
	case grazing:
		tx, ty = b.goalX-c.x, b.goalY-c.y
	default:
		ahead := 160 + sp.R
		if !a.fits(sp.Habitat, c.x+math.Cos(b.heading)*ahead, c.y+math.Sin(b.heading)*ahead) {
			b.heading += math.Pi/2 + a.rng.Float64()*math.Pi
		}
		tx, ty = math.Cos(b.heading), math.Sin(b.heading)
	}
	// keep off the border
	if c.x < 150 {
		tx += 2
	} else if c.x > worldW-150 {
		tx -= 2
	}
	if c.y < 150 {
		ty += 2
	} else if c.y > worldH-150 {
		ty -= 2
	}
	if m := math.Hypot(tx, ty); m > 0.001 {
		c.dx, c.dy = tx/m, ty/m
	} else {
		c.dx, c.dy = 0, 0
	}
	if b.mode == wandering {
		c.dx, c.dy = c.dx*0.55, c.dy*0.55
	}
}

// botAttack uses a bot's ability on its prey when it would land.
func (a *arena) botAttack(c, t *creature, d float64) {
	if c.abilityCd > 0 || a.rng.Float64() > c.bot.bold*0.5 {
		return
	}
	switch c.kind().Ability.Kind {
	case charge:
		if d < 160 {
			a.useAbility(c)
		}
	case stomp, pull:
		if math.Hypot(t.x-c.x, t.y-c.y) < reach(c) {
			a.useAbility(c)
		}
	case spit:
		if d < 450 {
			c.angle = math.Atan2(t.y-c.y, t.x-c.x)
			a.useAbility(c)
		}
	}
}

// botEvolve answers a bot's offer: one of its species' next, at random, that is no bigger than a bot may be and gets
// about where the bot is; or, if none is, it stays and spends the point.
func (a *arena) botEvolve(c *creature) {
	var options []int
	for _, n := range c.kind().Next {
		if s := speciesList[n]; s.Tier <= botTopTier && a.fits(s.Habitat, c.x, c.y) {
			options = append(options, n)
		}
	}
	if len(options) == 0 {
		a.evolve(c, -1)
		a.upgrade(c, stats[a.rng.IntN(len(stats))])
		return
	}
	a.evolve(c, options[a.rng.IntN(len(options))])
}

func (a *arena) decide(c *creature) {
	b := c.bot
	sp := c.kind()
	var threat, prey *creature
	td, pd := 320*b.wary, botChaseRange
	if b.rest > 0 {
		pd = 0
	}
	for _, o := range a.creatures {
		if o == c || o.dead != nil {
			continue
		}
		d := math.Hypot(o.x-c.x, o.y-c.y) - o.r() - sp.R
		if o.tier() > c.tier() && d < td {
			threat, td = o, d
		}
		if o.tier() < c.tier() && !o.hidden && o.guard == 0 && d < pd && a.fits(sp.Habitat, o.x, o.y) {
			prey, pd = o, d
		}
	}
	switch {
	case threat != nil:
		b.mode, b.target, b.goalX, b.goalY = fleeing, threat, 0, 0
		if sp.Hides || climbs(c) && !climbs(threat) {
			best := 300.0
			tx, ty := threat.x-c.x, threat.y-c.y
			tl := max(1, math.Hypot(tx, ty))
			refuges := [][]circle{a.rocks, a.reefs} // somewhere the threat cannot follow
			if sp.Hides {
				refuges = append(refuges, a.bushes, a.kelp)
			}
			for _, set := range refuges {
				for _, bu := range set {
					d := math.Hypot(bu.X-c.x, bu.Y-c.y)
					// the nearest cover that is not past the threat
					if d < best && (bu.X-c.x)*tx+(bu.Y-c.y)*ty < 0.3*d*tl {
						best, b.goalX, b.goalY = d, bu.X, bu.Y
					}
				}
			}
		}
	case prey != nil:
		if b.mode != chasing || b.target != prey {
			b.chased = 0
		}
		b.mode, b.target = chasing, prey
	default:
		best := 420.0
		b.mode = wandering
		for _, f := range a.food {
			if math.Abs(f.x-c.x) > best || math.Abs(f.y-c.y) > best {
				continue
			}
			if d := math.Hypot(f.x-c.x, f.y-c.y); d < best && a.fits(sp.Habitat, f.x, f.y) {
				best, b.goalX, b.goalY, b.mode = d, f.x, f.y, grazing
			}
		}
		if b.mode == wandering && a.rng.Float64() < 0.15 {
			b.heading += (a.rng.Float64() - 0.5) * 2
		}
	}
}
