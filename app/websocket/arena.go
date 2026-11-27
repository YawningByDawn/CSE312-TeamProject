package websocket

import (
	"encoding/json"
	"html"
	"math"
	"math/rand/v2"
	"slices"
	"strconv"
)

// The arena is the game, Gobble Grove: one meadow that every logged-in player shares, topped up with bots so it is
// never empty. Creatures eat food to gain xp, and at each species' xp mark they evolve into the next, bigger one. A
// creature eats any creature of a lower tier it catches; one of its own tier (or one tier up) it can only bite, with a
// boost, and a bite that empties the other's hp eats it. Small creatures hide in bushes, and frogs under water, where
// nothing can eat them. Hunger falls all the time, faster the bigger the creature is, and an empty belly costs hp.
// Only the hub goroutine touches an arena; it steps it once a tick.

type species struct {
	Name  string  `json:"name"`
	R     float64 `json:"r"`     // radius, px
	XP    float64 `json:"xp"`    // xp it takes to become this species
	Speed float64 `json:"speed"` // px a second
	View  float64 `json:"view"`  // the height of the world a player of this species sees, px
	Hides bool    `json:"hides"` // can hide in bushes
	Swims bool    `json:"swims"` // fast in water, and hidden there
}

// speciesList is the food chain, smallest first; a creature's tier is its index here.
var speciesList = []species{
	{Name: "Beetle", R: 14, XP: 0, Speed: 255, View: 780, Hides: true},
	{Name: "Frog", R: 18, XP: 40, Speed: 250, View: 860, Hides: true, Swims: true},
	{Name: "Hare", R: 22, XP: 120, Speed: 272, View: 940, Hides: true},
	{Name: "Hedgehog", R: 26, XP: 260, Speed: 236, View: 1020, Hides: true},
	{Name: "Boar", R: 31, XP: 480, Speed: 240, View: 1100},
	{Name: "Lynx", R: 36, XP: 800, Speed: 250, View: 1180},
	{Name: "Wolf", R: 42, XP: 1300, Speed: 244, View: 1270},
	{Name: "Bear", R: 49, XP: 2000, Speed: 224, View: 1360},
	{Name: "Bison", R: 57, XP: 3000, Speed: 218, View: 1460},
	{Name: "Mammoth", R: 66, XP: 4400, Speed: 205, View: 1560},
}

type foodKind struct {
	Name   string  `json:"name"`
	R      float64 `json:"r"`
	XP     float64 `json:"xp"`
	Hunger float64 `json:"hunger"`
	share  float64 // its share of what grows; meat only falls from creatures that starve
}

var foodKinds = []foodKind{
	{Name: "berry", R: 7, XP: 3, Hunger: 5, share: 0.55},
	{Name: "mushroom", R: 9, XP: 6, Hunger: 7, share: 0.3},
	{Name: "apple", R: 11, XP: 12, Hunger: 12, share: 0.15},
	{Name: "meat", R: 10, XP: 15, Hunger: 18},
}

const meat = 3 // index of meat in foodKinds

const (
	worldW, worldH = 4000.0, 4000.0
	maxHP          = 100.0
	maxHunger      = 100.0
	spawnGuard     = 3.0  // seconds a new creature cannot be eaten or bitten
	boostTime      = 0.35 // seconds a boost lasts
	boostCooldown  = 1.6  // seconds between boosts
	boostCost      = 4.0  // hunger
	boostSpeed     = 2.1  // times the species' speed
	biteSame       = 34.0 // hp a boosting bite takes from a creature of the biter's tier
	biteUp         = 18.0 // and from one a tier above it
	spectatorView  = 1100.0
)

var botNames = []string{
	"Bramble", "Thistle", "Mossback", "Pebble", "Juniper", "Clover", "Sorrel", "Burdock", "Nettle", "Fennel",
	"Hazel", "Rowan", "Tansy", "Yarrow", "Bracken", "Sedge", "Wren", "Marlow", "Quill", "Tumble", "Cinder",
	"Dapple", "Flint", "Gorse", "Heath", "Larch", "Midge", "Nutmeg", "Pip", "Rush", "Sloe", "Teasel", "Umber",
	"Vetch", "Whin", "Burr",
}

type circle struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	R float64 `json:"r"`
}

type creature struct {
	id                    int
	name                  string
	nameJSON              []byte // name as a JSON string, html-escaped like every name the app sends
	bot                   *brain // nil for a player's creature
	sp                    int    // tier: its index in speciesList
	x, y, vx, vy, angle   float64
	dx, dy                float64 // where it is steering; |d| <= 1 is the share of full speed
	xp, hp, hunger        float64
	cooldown, dash, guard float64 // seconds
	bit                   bool    // this boost already bit someone
	hidden, wet           bool
	kills                 int
	born                  float64 // arena clock
	dead                  *death  // set the tick it dies
}

// death is how a creature ended; a player's view shows it until they spawn again.
type death struct {
	By    string  // the name of who ate it, "" when it starved
	BySp  int     // their tier
	Sp    int     // the tier it had reached
	XP    float64 // and its xp
	Kills int
	Secs  float64 // how long it lived
	left  bool    // its player left: no meat
}

type foodItem struct {
	id, kind int
	x, y     float64
}

// eaten is one thing eaten this tick, for the views to animate: food or a creature, and the id of the creature that ate it.
type eaten struct {
	food   bool
	id, by int
}

type brain struct {
	mode         int // what it is doing: wandering, eating, chasing or fleeing
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
	botTopTier    = 6     // bots grow no bigger than a wolf: the top of the chain is for players
	botXP         = 0.35  // bots gain xp at this share of the rate players do
	botChaseRange = 280.0 // px between bodies at which a bot starts after prey
	botChaseFor   = 3.5   // seconds a bot keeps after prey before it gives up
	botRestFor    = 2.5   // seconds before it chases again
)

const (
	wandering = iota
	grazing
	chasing
	fleeing
)

type arena struct {
	rng            *rand.Rand
	rate           int
	clock          float64
	nextID         int
	creatures      []*creature
	food           []*foodItem
	bushes, ponds  []circle
	eaten          []eaten
	foodTarget     int // how much food the meadow grows back to
	minBots        int // bots the arena keeps however many players there are
	totalCreatures int // creatures bots fill the arena up to
	botTimer       float64
	world          []byte // the map as a "world" message, sent once to each connection
	board          []byte // the leaderboard as JSON, refreshed each step
}

func newArena(rng *rand.Rand, rate int) *arena {
	a := &arena{rng: rng, rate: rate, foodTarget: 520, minBots: 12, totalCreatures: 36}
	a.ponds = a.scatter(9, 150, 300, 320, nil)
	a.bushes = a.scatter(60, 55, 95, 120, a.ponds)
	a.world = encodeWorld(a)
	for len(a.food) < a.foodTarget {
		a.grow(-1)
	}
	for range a.totalCreatures {
		a.spawnBot()
	}
	a.board = encodeBoard(a.creatures)
	return a
}

// scatter places n circles with radii in [minR, maxR], at least `edge` from the world's border, apart from each other and from `avoid`.
func (a *arena) scatter(n int, minR, maxR, edge float64, avoid []circle) []circle {
	out := []circle{}
	for tries := 0; len(out) < n && tries < n*60; tries++ {
		c := circle{R: minR + a.rng.Float64()*(maxR-minR)}
		c.X = edge + a.rng.Float64()*(worldW-2*edge)
		c.Y = edge + a.rng.Float64()*(worldH-2*edge)
		clear := true
		for _, o := range slices.Concat(out, avoid) {
			if math.Hypot(c.X-o.X, c.Y-o.Y) < c.R+o.R+90 {
				clear = false
				break
			}
		}
		if clear {
			out = append(out, c)
		}
	}
	return out
}

func (a *arena) id() int {
	a.nextID++
	return a.nextID
}

func (a *arena) inPond(x, y float64) bool {
	for _, p := range a.ponds {
		if math.Hypot(x-p.X, y-p.Y) < p.R {
			return true
		}
	}
	return false
}

// bushAt is the bush that covers a creature of radius r at x, y: its middle well inside.
func (a *arena) bushAt(x, y, r float64) *circle {
	for i := range a.bushes {
		b := &a.bushes[i]
		if math.Hypot(x-b.X, y-b.Y)+r*0.6 < b.R {
			return b
		}
	}
	return nil
}

// grow adds one food: of `kind`, or of a kind drawn by share when kind < 0, somewhere dry.
func (a *arena) grow(kind int) {
	if kind < 0 {
		roll := a.rng.Float64()
		kind = 0
		for roll > foodKinds[kind].share && kind < meat-1 {
			roll -= foodKinds[kind].share
			kind++
		}
	}
	for range 20 {
		x, y := 30+a.rng.Float64()*(worldW-60), 30+a.rng.Float64()*(worldH-60)
		if !a.inPond(x, y) {
			a.food = append(a.food, &foodItem{id: a.id(), kind: kind, x: x, y: y})
			return
		}
	}
}

// spawnPoint is a dry place, the one of a few tries furthest from anything bigger than tier sp.
func (a *arena) spawnPoint(sp int) (float64, float64) {
	bestX, bestY, best := worldW/2, worldH/2, -1.0
	for range 16 {
		x, y := 100+a.rng.Float64()*(worldW-200), 100+a.rng.Float64()*(worldH-200)
		if a.inPond(x, y) {
			continue
		}
		near := 1e9
		for _, c := range a.creatures {
			if c.sp > sp {
				near = min(near, math.Hypot(c.x-x, c.y-y))
			}
		}
		if near > best {
			bestX, bestY, best = x, y, near
		}
	}
	return bestX, bestY
}

func (a *arena) add(name string, sp int, xp float64, bot *brain) *creature {
	c := &creature{id: a.id(), name: name, bot: bot, sp: sp, xp: xp, hp: maxHP, hunger: maxHunger * 0.8, guard: spawnGuard, born: a.clock}
	c.nameJSON, _ = json.Marshal(html.EscapeString(name))
	c.x, c.y = a.spawnPoint(sp)
	c.angle = a.rng.Float64() * 2 * math.Pi
	a.creatures = append(a.creatures, c)
	return c
}

// spawn starts a player's new creature as the smallest species.
func (a *arena) spawn(name string) *creature {
	return a.add(name, 0, 0, nil)
}

// spawnBot adds a bot: half are beetles, and few are bigger than a hedgehog.
func (a *arena) spawnBot() {
	r := a.rng.Float64()
	sp := int(r * r * r * 7)
	next := speciesList[min(sp+1, len(speciesList)-1)].XP
	xp := speciesList[sp].XP + a.rng.Float64()*(next-speciesList[sp].XP)*0.5
	b := &brain{heading: a.rng.Float64() * 2 * math.Pi, wary: 0.6 + a.rng.Float64()*0.5, bold: 0.2 + a.rng.Float64()*0.5, lifespan: 90 + a.rng.Float64()*180}
	a.add(a.botName(), sp, xp, b)
}

// botName picks a name no living creature has, if a few tries find one.
func (a *arena) botName() string {
	name := botNames[a.rng.IntN(len(botNames))]
	for range 8 {
		if !slices.ContainsFunc(a.creatures, func(c *creature) bool { return c.name == name }) {
			break
		}
		name = botNames[a.rng.IntN(len(botNames))]
	}
	return name
}

// remove takes a creature out at the next step, as when its player has gone for good.
func (a *arena) remove(c *creature) {
	if c.dead == nil {
		c.dead = &death{left: true}
	}
}

// boost starts a dash, if the creature has the hunger and is not cooling down. A boost ends spawn protection.
func (a *arena) boost(c *creature) {
	if c.dead != nil || c.cooldown > 0 || c.hunger < boostCost {
		return
	}
	c.dash, c.cooldown, c.bit, c.guard = boostTime, boostCooldown, false, 0
	c.hunger -= boostCost
}

func (a *arena) step(dt float64) {
	a.clock += dt
	a.eaten = a.eaten[:0]
	for _, c := range a.creatures {
		if c.bot != nil {
			a.think(c, dt)
		}
	}
	for _, c := range a.creatures {
		a.move(c, dt)
	}
	a.graze()
	a.contact()
	a.metabolise(dt)
	a.creatures = slices.DeleteFunc(a.creatures, func(c *creature) bool { return c.dead != nil })
	for _, c := range a.creatures { // pushes and growing can reach past the border
		r := speciesList[c.sp].R
		c.x, c.y = max(r, min(worldW-r, c.x)), max(r, min(worldH-r, c.y))
	}
	a.restock(dt)
	a.board = encodeBoard(a.creatures)
}

func (a *arena) move(c *creature, dt float64) {
	sp := speciesList[c.sp]
	c.cooldown = max(0, c.cooldown-dt)
	c.guard = max(0, c.guard-dt)
	if c.dash > 0 {
		c.dash -= dt
	}
	dx, dy := c.dx, c.dy
	m := math.Hypot(dx, dy)
	if m > 1 {
		dx, dy, m = dx/m, dy/m, 1
	}
	if m > 0.05 {
		c.angle = math.Atan2(dy, dx)
	}
	speed := sp.Speed
	c.wet = a.inPond(c.x, c.y)
	switch {
	case c.wet && sp.Swims:
		speed *= 1.15
	case c.wet:
		speed *= 0.6
	case !sp.Hides && a.bushAt(c.x, c.y, 0) != nil:
		speed *= 0.75 // the big ones push through
	}
	tx, ty := dx*speed, dy*speed
	if c.dash > 0 { // a dash goes the way it faces, flat out
		tx, ty = math.Cos(c.angle)*speed*boostSpeed, math.Sin(c.angle)*speed*boostSpeed
	}
	k := min(1, dt*8)
	c.vx += (tx - c.vx) * k
	c.vy += (ty - c.vy) * k
	c.x = max(sp.R, min(worldW-sp.R, c.x+c.vx*dt))
	c.y = max(sp.R, min(worldH-sp.R, c.y+c.vy*dt))
	c.hidden = (sp.Hides && a.bushAt(c.x, c.y, sp.R) != nil) || (sp.Swims && c.wet)
}

// graze lets each creature eat the food it touches. Plants feed the big ones less; meat feeds everyone the same.
func (a *arena) graze() {
	for _, c := range a.creatures {
		r := speciesList[c.sp].R
		plant := max(0.3, 1-0.08*float64(c.sp))
		for i := 0; i < len(a.food); i++ {
			f := a.food[i]
			k := foodKinds[f.kind]
			if math.Abs(f.x-c.x) > r+k.R || math.Abs(f.y-c.y) > r+k.R || math.Hypot(f.x-c.x, f.y-c.y) > r+k.R*0.3 {
				continue
			}
			share := plant
			if f.kind == meat {
				share = 1
			}
			c.gain(k.XP * share)
			c.hunger = min(maxHunger, c.hunger+k.Hunger*share)
			a.eaten = append(a.eaten, eaten{food: true, id: f.id, by: c.id})
			a.food[i] = a.food[len(a.food)-1]
			a.food = a.food[:len(a.food)-1]
			i--
		}
	}
}

// contact settles every pair of creatures that touch: one eats the other, bites it, or they push apart.
func (a *arena) contact() {
	for i, p := range a.creatures {
		for _, q := range a.creatures[i+1:] {
			if p.dead != nil {
				break
			}
			if q.dead != nil {
				continue
			}
			big, small := p, q
			if q.sp > p.sp {
				big, small = q, p
			}
			rb, rs := speciesList[big.sp].R, speciesList[small.sp].R
			d := math.Hypot(big.x-small.x, big.y-small.y)
			if d >= rb+rs || small.hidden || big.hidden && big.sp == small.sp {
				continue
			}
			switch {
			case big.sp > small.sp:
				switch {
				case big.sp == small.sp+1 && small.dash > 0 && !small.bit && big.guard == 0:
					a.bite(small, big, biteUp) // a boost into the tier above bites before it can be eaten
				case small.guard == 0 && d < rb+rs*0.3:
					a.eat(big, small)
				case small.guard > 0:
					push(big, small, d, rb+rs)
				}
			default:
				if p.dash > 0 && !p.bit && q.guard == 0 {
					a.bite(p, q, biteSame)
				}
				if q.dead == nil && q.dash > 0 && !q.bit && p.guard == 0 {
					a.bite(q, p, biteSame)
				}
				if p.dead == nil && q.dead == nil {
					push(p, q, d, rb+rs)
				}
			}
		}
	}
}

// push moves two overlapping creatures apart, the smaller further.
func push(p, q *creature, d, reach float64) {
	nx, ny := 1.0, 0.0
	if d > 0.001 {
		nx, ny = (q.x-p.x)/d, (q.y-p.y)/d
	}
	overlap := reach - d
	rp, rq := speciesList[p.sp].R, speciesList[q.sp].R
	wp := rq * rq / (rp*rp + rq*rq)
	p.x, p.y = p.x-nx*overlap*wp, p.y-ny*overlap*wp
	q.x, q.y = q.x+nx*overlap*(1-wp), q.y+ny*overlap*(1-wp)
}

// bite takes dmg from the victim and knocks it back; a bite that empties its hp eats it.
func (a *arena) bite(biter, victim *creature, dmg float64) {
	biter.bit = true
	victim.hp -= dmg
	d := math.Hypot(victim.x-biter.x, victim.y-biter.y)
	if d > 0.001 {
		victim.vx += (victim.x - biter.x) / d * 320
		victim.vy += (victim.y - biter.y) / d * 320
	}
	if victim.hp <= 0 {
		a.eat(biter, victim)
	}
}

func (a *arena) eat(eater, prey *creature) {
	prey.dead = &death{By: eater.name, BySp: eater.sp, Sp: prey.sp, XP: prey.xp, Kills: prey.kills, Secs: a.clock - prey.born}
	eater.gain(10 + prey.xp*0.4)
	eater.hunger = min(maxHunger, eater.hunger+25+5*float64(prey.sp))
	eater.hp = min(maxHP, eater.hp+15)
	eater.kills++
	a.eaten = append(a.eaten, eaten{id: prey.id, by: eater.id})
}

// gain adds xp: a bot's more slowly, and only up to the top of the tier it may reach.
func (c *creature) gain(xp float64) {
	if c.bot == nil {
		c.xp += xp
		return
	}
	c.xp = min(c.xp+xp*botXP, speciesList[botTopTier+1].XP-1)
}

// dropMeat leaves a dead creature's meat where it fell.
func (a *arena) dropMeat(c *creature) {
	for range 2 + c.sp/2 {
		a.food = append(a.food, &foodItem{id: a.id(), kind: meat, x: c.x + (a.rng.Float64()-0.5)*40, y: c.y + (a.rng.Float64()-0.5)*40})
	}
}

// metabolise burns hunger, heals or starves, and evolves whoever has the xp for it. Old bots die.
func (a *arena) metabolise(dt float64) {
	for _, c := range a.creatures {
		if c.dead != nil {
			continue
		}
		c.hunger -= (0.4 + 0.15*float64(c.sp)) * dt
		switch {
		case c.hunger <= 0:
			c.hunger = 0
			c.hp -= 6 * dt
		case c.hunger > 30:
			c.hp = min(maxHP, c.hp+3*dt)
		}
		if c.hp <= 0 || c.bot != nil && a.clock-c.born > c.bot.lifespan {
			c.dead = &death{Sp: c.sp, XP: c.xp, Kills: c.kills, Secs: a.clock - c.born}
			a.dropMeat(c)
			continue
		}
		for c.sp+1 < len(speciesList) && c.xp >= speciesList[c.sp+1].XP {
			c.sp++
			c.hp = maxHP
			c.hunger = min(maxHunger, c.hunger+25)
		}
	}
}

// restock regrows food and brings in bots, a few a second, until the meadow is full again.
func (a *arena) restock(dt float64) {
	for n := int(math.Ceil(dt * 40)); n > 0 && len(a.food) < a.foodTarget; n-- {
		a.grow(-1)
	}
	players, bots := 0, 0
	for _, c := range a.creatures {
		if c.bot == nil {
			players++
		} else {
			bots++
		}
	}
	want := max(a.minBots, a.totalCreatures-players)
	if bots >= want {
		a.botTimer = 0
		return
	}
	if a.botTimer += dt; a.botTimer >= 0.5 {
		a.botTimer = 0
		a.spawnBot()
	}
}

// think steers a bot: away from what could eat it, after what it could eat, to food, or anywhere.
func (a *arena) think(c *creature, dt float64) {
	b := c.bot
	sp := speciesList[c.sp]
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
		d := math.Hypot(t.x-c.x, t.y-c.y) - speciesList[t.sp].R - sp.R
		if b.mode == chasing {
			tx, ty = t.x+t.vx*0.2-c.x, t.y+t.vy*0.2-c.y
		} else {
			tx, ty = c.x-t.x, c.y-t.y
			if b.goalX != 0 || b.goalY != 0 { // a bush to hide in
				tx, ty = b.goalX-c.x, b.goalY-c.y
			}
			if c.hidden {
				tx, ty = 0, 0
			}
		}
		if d < 90 && a.rng.Float64() < b.bold*dt*6 {
			a.boost(c)
		}
	case grazing:
		tx, ty = b.goalX-c.x, b.goalY-c.y
	default:
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

func (a *arena) decide(c *creature) {
	b := c.bot
	sp := speciesList[c.sp]
	var threat, prey *creature
	td, pd := 320*b.wary, botChaseRange
	if b.rest > 0 {
		pd = 0
	}
	for _, o := range a.creatures {
		if o == c || o.dead != nil {
			continue
		}
		d := math.Hypot(o.x-c.x, o.y-c.y) - speciesList[o.sp].R - sp.R
		if o.sp > c.sp && d < td {
			threat, td = o, d
		}
		if o.sp < c.sp && !o.hidden && o.guard == 0 && d < pd {
			prey, pd = o, d
		}
	}
	switch {
	case threat != nil:
		b.mode, b.target, b.goalX, b.goalY = fleeing, threat, 0, 0
		if sp.Hides {
			best := 300.0
			tx, ty := threat.x-c.x, threat.y-c.y
			tl := max(1, math.Hypot(tx, ty))
			for _, bu := range a.bushes {
				d := math.Hypot(bu.X-c.x, bu.Y-c.y)
				// the nearest bush that is not past the threat
				if d < best && (bu.X-c.x)*tx+(bu.Y-c.y)*ty < 0.3*d*tl {
					best, b.goalX, b.goalY = d, bu.X, bu.Y
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
			if d := math.Hypot(f.x-c.x, f.y-c.y); d < best {
				best, b.goalX, b.goalY, b.mode = d, f.x, f.y, grazing
			}
		}
		if b.mode == wandering && a.rng.Float64() < 0.15 {
			b.heading += (a.rng.Float64() - 0.5) * 2
		}
	}
}

// viewer is what a player's view is about: their creature, or while they have none, where to look.
type viewer struct {
	cr     *creature
	died   *death
	camX   float64
	camY   float64
	follow bool // no creature and no death yet: watch the leader
}

// view is the "state" message for one player: their own numbers, and the creatures, food and eating near them.
func (a *arena) view(v viewer) []byte {
	cx, cy, h := v.camX, v.camY, spectatorView
	if v.cr != nil {
		cx, cy, h = v.cr.x, v.cr.y, speciesList[v.cr.sp].View
	} else if v.follow {
		cx, cy = worldW/2, worldH/2
		if top := leader(a.creatures); top != nil {
			cx, cy = top.x, top.y
		}
	}
	// what a screen can see, with a margin: up to 1.25 views high (a portrait screen) or 2.4 views wide
	halfH, halfW := h*0.625+150, h*1.2+200
	near := func(x, y float64) bool { return math.Abs(x-cx) < halfW && math.Abs(y-cy) < halfH }

	b := []byte(`{"type":"state","t":`)
	b = strconv.AppendFloat(b, a.clock, 'f', 3, 64)
	b = append(b, `,"x":`...)
	b = strconv.AppendInt(b, int64(cx), 10)
	b = append(b, `,"y":`...)
	b = strconv.AppendInt(b, int64(cy), 10)
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
		b = strconv.AppendInt(b, int64(c.id), 10)
		b = append(b, ',')
		b = strconv.AppendInt(b, int64(math.Round(c.x)), 10)
		b = append(b, ',')
		b = strconv.AppendInt(b, int64(math.Round(c.y)), 10)
		b = append(b, ',')
		b = strconv.AppendFloat(b, c.angle, 'f', 2, 64)
		b = append(b, ',')
		b = strconv.AppendInt(b, int64(c.sp), 10)
		b = append(b, ',')
		b = strconv.AppendInt(b, int64(math.Ceil(c.hp)), 10)
		b = append(b, ',')
		b = strconv.AppendInt(b, int64(flags(c)), 10)
		b = append(b, ',')
		b = append(b, c.nameJSON...)
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
		b = strconv.AppendInt(b, int64(f.id), 10)
		b = append(b, ',')
		b = strconv.AppendInt(b, int64(math.Round(f.x)), 10)
		b = append(b, ',')
		b = strconv.AppendInt(b, int64(math.Round(f.y)), 10)
		b = append(b, ',')
		b = strconv.AppendInt(b, int64(f.kind), 10)
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
		b = strconv.AppendInt(b, int64(kind), 10)
		b = append(b, ',')
		b = strconv.AppendInt(b, int64(e.id), 10)
		b = append(b, ',')
		b = strconv.AppendInt(b, int64(e.by), 10)
		b = append(b, ']')
	}
	b = append(b, `],"lb":`...)
	b = append(b, a.board...)
	return append(b, '}')
}

// flags packs a creature's state for the view: 1 hidden, 2 boosting, 4 a bot, 8 spawn-protected, 16 in water.
func flags(c *creature) int {
	f := 0
	if c.hidden {
		f |= 1
	}
	if c.dash > 0 {
		f |= 2
	}
	if c.bot != nil {
		f |= 4
	}
	if c.guard > 0 {
		f |= 8
	}
	if c.wet {
		f |= 16
	}
	return f
}

func leader(cs []*creature) *creature {
	var top *creature
	for _, c := range cs {
		if c.dead == nil && (top == nil || c.xp > top.xp) {
			top = c
		}
	}
	return top
}
