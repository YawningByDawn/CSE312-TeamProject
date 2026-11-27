package websocket

import (
	"encoding/json"
	"html"
	"math"
	"math/rand/v2"
	"slices"
)

// The arena is the game, Gobble Grove: one world that every player (logged in or a guest) shares, topped up with bots
// so it is never empty. Land runs west to a beach; the sea lies east of it. Creatures eat food to gain xp, and with
// enough of it a creature may evolve into one of the species its own leads to (species.go), or stay as it is for a
// stat point that raises its bite or its ability. A creature eats any creature of a lower tier it catches; one of its
// own tier (or one tier up) it can only hurt, by biting with a boost or with its ability, and a hurt that empties the
// other's hp eats it. Small creatures hide in bushes and kelp, where nothing can eat them. Hunger falls all the time,
// faster the bigger the creature is, and an empty belly costs hp. Only the hub goroutine touches an arena; it steps
// it once a tick.

type foodKind struct {
	Name   string  `json:"name"`
	R      float64 `json:"r"`
	XP     float64 `json:"xp"`
	Hunger float64 `json:"hunger"`
	Sea    bool    `json:"sea"` // grows in the sea, not on land
	share  float64 // its share of what grows where it grows; meat only falls from creatures that die without being eaten
}

var foodKinds = []foodKind{
	{Name: "berry", R: 7, XP: 3, Hunger: 5, share: 0.5},
	{Name: "mushroom", R: 9, XP: 6, Hunger: 7, share: 0.3},
	{Name: "egg", R: 10, XP: 12, Hunger: 12, share: 0.2},
	{Name: "krill", R: 7, XP: 3, Hunger: 5, Sea: true, share: 0.55},
	{Name: "clam", R: 9, XP: 6, Hunger: 7, Sea: true, share: 0.3},
	{Name: "fish", R: 11, XP: 12, Hunger: 12, Sea: true, share: 0.15},
	{Name: "meat", R: 10, XP: 15, Hunger: 18},
}

const meat = 6 // index of meat in foodKinds

const (
	worldW, worldH = 7200.0, 6000.0
	coastStep      = 150.0 // px between the points of the coastline
	maxHunger      = 100.0
	spawnGuard     = 3.0  // seconds a new creature cannot be eaten or hurt
	boostTime      = 0.35 // seconds a boost lasts
	boostCooldown  = 1.6  // seconds between boosts
	boostCost      = 4.0  // hunger
	boostSpeed     = 2.1  // times the species' speed
	maxLevel       = 5    // the most a stat can be raised
	levelBonus     = 0.2  // damage a level adds, as a share
	spectatorView  = 1100.0
)

// terrain under a point
const (
	ground = iota
	pond
	ocean
)

var botNames = []string{
	"Bramble", "Thistle", "Mossback", "Pebble", "Juniper", "Clover", "Sorrel", "Burdock", "Nettle", "Fennel",
	"Hazel", "Rowan", "Tansy", "Yarrow", "Bracken", "Sedge", "Wren", "Marlow", "Quill", "Tumble", "Cinder",
	"Dapple", "Flint", "Gorse", "Heath", "Larch", "Midge", "Nutmeg", "Pip", "Rush", "Sloe", "Teasel", "Umber",
	"Vetch", "Whin", "Burr", "Coral", "Kelpie", "Brine", "Shoal", "Driftwood", "Barnacle", "Skerry", "Tidewrack",
	"Pumice", "Obsidian", "Amber", "Fossil",
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
	sp                    int    // its species: an index in speciesList
	x, y, vx, vy, angle   float64
	dx, dy                float64 // where it is steering; |d| <= 1 is the share of full speed
	xp                    float64 // all it has gained: its score
	progress              float64 // xp gained toward its next evolution
	hp, hunger            float64
	cooldown, dash, guard float64 // seconds
	abilityCd             float64 // seconds until its ability is ready
	charging              float64 // seconds left of an ability charge
	fx                    float64 // seconds its ability shows
	bit, chargeHit        bool    // this boost already bit someone; this charge already hit someone
	offer                 bool    // it may evolve, and has not chosen
	points                int     // stat points to spend
	biteLv, abilityLv     int
	hidden, wet           bool
	kills                 int
	born                  float64 // arena clock
	dead                  *death  // set the tick it dies
}

func (c *creature) kind() *species { return &speciesList[c.sp] }
func (c *creature) tier() int      { return speciesList[c.sp].Tier }
func (c *creature) r() float64     { return speciesList[c.sp].R }
func (c *creature) maxHP() float64 { return maxHP(c.tier()) }

// death is how a creature ended; a player's view shows it until they spawn again.
type death struct {
	By    string // the name of who ate it, "" when it starved
	BySp  int    // their species
	Sp    int    // the species it had reached
	XP    float64
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

type arena struct {
	rng                 *rand.Rand
	rate                int
	clock               float64
	nextID              int
	creatures           []*creature
	food                []*foodItem
	shots               []*shot
	coast               []float64 // the coastline: the sea starts at coast[i] px from the west, at y = i*coastStep
	ponds, bushes, kelp []circle
	eaten               []eaten
	landFood, seaFood   int // how much food the land and the sea grow back to
	minBots             int // bots the arena keeps however many players there are
	totalCreatures      int // creatures bots fill the arena up to
	botTimer            float64
	world               []byte // the map as a "world" message, sent once to each connection
	board               []byte // the leaderboard as JSON, refreshed each step
}

func newArena(rng *rand.Rand, rate int) *arena {
	a := &arena{rng: rng, rate: rate, landFood: 800, seaFood: 350, minBots: 16, totalCreatures: 50}
	p1, p2 := rng.Float64()*6, rng.Float64()*6
	for y := 0.0; y <= worldH+coastStep; y += coastStep {
		a.coast = append(a.coast, 5000+230*math.Sin(y/900+p1)+110*math.Sin(y/340+p2))
	}
	a.ponds = a.scatter(12, 140, 300, nil, func(x, y, r float64) bool { return x+r+350 < a.coastX(y) })
	a.bushes = a.scatter(100, 55, 95, a.ponds, func(x, y, r float64) bool { return x+r+220 < a.coastX(y) })
	a.kelp = a.scatter(34, 60, 110, nil, func(x, y, r float64) bool { return x-r-220 > a.coastX(y) })
	a.world = encodeWorld(a)
	a.restockFood(math.MaxInt)
	for range a.totalCreatures {
		a.spawnBot()
	}
	a.board = encodeBoard(a.creatures)
	return a
}

// scatter places n circles with radii in [minR, maxR] where ok says, apart from each other and from `avoid`.
func (a *arena) scatter(n int, minR, maxR float64, avoid []circle, ok func(x, y, r float64) bool) []circle {
	out := []circle{}
	for tries := 0; len(out) < n && tries < n*80; tries++ {
		c := circle{R: minR + a.rng.Float64()*(maxR-minR)}
		c.X = c.R + 120 + a.rng.Float64()*(worldW-2*c.R-240)
		c.Y = c.R + 120 + a.rng.Float64()*(worldH-2*c.R-240)
		if !ok(c.X, c.Y, c.R) {
			continue
		}
		clear := true
		for _, o := range slices.Concat(out, avoid) {
			if math.Hypot(c.X-o.X, c.Y-o.Y) < c.R+o.R+80 {
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

// coastX is how far east the land runs at y.
func (a *arena) coastX(y float64) float64 {
	f := max(0, min(worldH, y)) / coastStep
	i := min(int(f), len(a.coast)-2)
	return a.coast[i] + (a.coast[i+1]-a.coast[i])*(f-float64(i))
}

func (a *arena) terrain(x, y float64) int {
	if x > a.coastX(y) {
		return ocean
	}
	for _, p := range a.ponds {
		if math.Abs(x-p.X) < p.R && math.Hypot(x-p.X, y-p.Y) < p.R {
			return pond
		}
	}
	return ground
}

// covered says whether a creature of radius r at x, y is hidden by a bush or kelp: its middle well inside one.
func (a *arena) covered(x, y, r float64) bool {
	for _, set := range [][]circle{a.bushes, a.kelp} {
		for _, b := range set {
			if math.Abs(x-b.X) < b.R && math.Hypot(x-b.X, y-b.Y)+r*0.6 < b.R {
				return true
			}
		}
	}
	return false
}

func inBush(bushes []circle, x, y float64) bool {
	for _, b := range bushes {
		if math.Abs(x-b.X) < b.R && math.Hypot(x-b.X, y-b.Y) < b.R {
			return true
		}
	}
	return false
}

// fits says whether a species can get about at x, y: land creatures out of the sea, sea creatures in it.
func (a *arena) fits(habitat string, x, y float64) bool {
	switch habitat {
	case land:
		return a.terrain(x, y) != ocean
	case sea:
		return a.terrain(x, y) == ocean
	}
	return true
}

// pace is the share of its speed a species moves at over a terrain.
func pace(habitat string, t int) float64 {
	switch {
	case habitat == air || t == ground && habitat != sea:
		return 1
	case habitat == land && t == pond:
		return 0.6
	case habitat == land:
		return 0.45
	case habitat == sea && t == ocean:
		return 1
	case habitat == sea && t == pond:
		return 0.8
	case habitat == sea:
		return 0.35 // stranded
	}
	return 1.1 // amphibious, in water
}

// growFood adds one food of a kind drawn by share, on land or in the sea.
func (a *arena) growFood(inSea bool) {
	roll := a.rng.Float64()
	kind := -1
	for i, k := range foodKinds {
		if k.Sea != inSea || k.share == 0 {
			continue
		}
		kind = i
		if roll < k.share {
			break
		}
		roll -= k.share
	}
	for range 20 {
		x, y := 30+a.rng.Float64()*(worldW-60), 30+a.rng.Float64()*(worldH-60)
		if t := a.terrain(x, y); (t == ocean) == inSea && t != pond {
			a.food = append(a.food, &foodItem{id: a.id(), kind: kind, x: x, y: y})
			return
		}
	}
}

// restockFood grows up to n food where the land or the sea has less than it should.
func (a *arena) restockFood(n int) {
	landN, seaN := 0, 0
	for _, f := range a.food {
		if foodKinds[f.kind].Sea {
			seaN++
		} else if f.kind != meat {
			landN++
		}
	}
	for ; n > 0 && (landN < a.landFood || seaN < a.seaFood); n-- {
		inSea := seaN < a.seaFood && (landN >= a.landFood || a.rng.Float64() < 0.35)
		a.growFood(inSea)
		if inSea {
			seaN++
		} else {
			landN++
		}
	}
}

// spawnPoint is a place a species is at home, the one of a few tries furthest from anything that could eat it.
func (a *arena) spawnPoint(sp int, inSea bool) (float64, float64) {
	tier := speciesList[sp].Tier
	bestX, bestY, best := worldW/3, worldH/2, -1.0
	for range 24 {
		x, y := 150+a.rng.Float64()*(worldW-300), 150+a.rng.Float64()*(worldH-300)
		coast := a.coastX(y)
		if inSea && x < coast+200 || !inSea && (x > coast-200 || a.terrain(x, y) != ground) {
			continue
		}
		near := 1e9
		for _, c := range a.creatures {
			if c.tier() > tier {
				near = min(near, math.Hypot(c.x-x, c.y-y))
			}
		}
		if near > best {
			bestX, bestY, best = x, y, near
		}
	}
	return bestX, bestY
}

func (a *arena) add(name string, sp int, xp float64, bot *brain, inSea bool) *creature {
	tier := speciesList[sp].Tier
	c := &creature{id: a.id(), name: name, bot: bot, sp: sp, xp: xp, hp: maxHP(tier), hunger: maxHunger * 0.8, guard: spawnGuard, born: a.clock}
	c.nameJSON, _ = json.Marshal(html.EscapeString(name))
	c.x, c.y = a.spawnPoint(sp, inSea)
	c.angle = a.rng.Float64() * 2 * math.Pi
	a.creatures = append(a.creatures, c)
	return c
}

// spawn starts a player's new creature as the starter species, on land.
func (a *arena) spawn(name string) *creature {
	return a.add(name, starter, 0, nil, false)
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

// evolve answers a creature's offer: into species `to`, one its species leads to, or, for a negative `to`, staying as it
// is for a stat point. Staying puts the next offer half as far off.
func (a *arena) evolve(c *creature, to int) {
	if c.dead != nil || !c.offer {
		return
	}
	need := tierNeed[c.tier()]
	if to < 0 {
		c.offer = false
		c.points++
		c.progress -= need / 2
		return
	}
	if !slices.Contains(c.kind().Next, to) {
		return
	}
	c.offer = false
	c.progress -= need
	c.sp = to
	c.hp = c.maxHP()
	c.hunger = min(maxHunger, c.hunger+25)
	c.abilityCd = 0
}

// upgrade spends a stat point on "bite" or "ability".
func (a *arena) upgrade(c *creature, stat string) {
	if c.dead != nil || c.points == 0 {
		return
	}
	lv := &c.biteLv
	if stat == "ability" {
		lv = &c.abilityLv
	}
	if *lv < maxLevel {
		*lv++
		c.points--
	}
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
	a.abilities(dt)
	a.graze()
	a.contact()
	a.metabolise(dt)
	a.creatures = slices.DeleteFunc(a.creatures, func(c *creature) bool { return c.dead != nil })
	for _, c := range a.creatures { // pushes and growing can reach past the border
		r := c.r()
		c.x, c.y = max(r, min(worldW-r, c.x)), max(r, min(worldH-r, c.y))
	}
	a.restockFood(int(math.Ceil(dt * 60)))
	a.restockBots(dt)
	a.board = encodeBoard(a.creatures)
}

func (a *arena) move(c *creature, dt float64) {
	sp := c.kind()
	c.cooldown = max(0, c.cooldown-dt)
	c.guard = max(0, c.guard-dt)
	c.dash = max(0, c.dash-dt)
	dx, dy := c.dx, c.dy
	m := math.Hypot(dx, dy)
	if m > 1 {
		dx, dy, m = dx/m, dy/m, 1
	}
	if m > 0.05 && c.charging <= 0 {
		c.angle = math.Atan2(dy, dx)
	}
	t := a.terrain(c.x, c.y)
	c.wet = t != ground
	speed := sp.Speed * pace(sp.Habitat, t)
	if t == ground && sp.Habitat == land && !sp.Hides && inBush(a.bushes, c.x, c.y) {
		speed *= 0.75 // the big ones push through
	}
	tx, ty := dx*speed, dy*speed
	switch { // a dash and a charge go the way it faces, flat out
	case c.charging > 0:
		tx, ty = math.Cos(c.angle)*speed*2.6, math.Sin(c.angle)*speed*2.6
	case c.dash > 0:
		tx, ty = math.Cos(c.angle)*speed*boostSpeed, math.Sin(c.angle)*speed*boostSpeed
	}
	k := min(1, dt*8)
	c.vx += (tx - c.vx) * k
	c.vy += (ty - c.vy) * k
	c.x = max(sp.R, min(worldW-sp.R, c.x+c.vx*dt))
	c.y = max(sp.R, min(worldH-sp.R, c.y+c.vy*dt))
	c.hidden = sp.Hides && (a.covered(c.x, c.y, sp.R) || sp.Habitat == amph && c.wet)
}

// graze lets each creature eat the food it touches. Plants and small sea food feed the big ones less; meat feeds
// everyone the same.
func (a *arena) graze() {
	for _, c := range a.creatures {
		r := c.r()
		plant := max(0.3, 1-0.08*float64(c.tier()))
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
			a.gain(c, k.XP*share)
			c.hunger = min(maxHunger, c.hunger+k.Hunger*share)
			a.eaten = append(a.eaten, eaten{food: true, id: f.id, by: c.id})
			a.food[i] = a.food[len(a.food)-1]
			a.food = a.food[:len(a.food)-1]
			i--
		}
	}
}

// gain adds xp, a bot's more slowly.
func (a *arena) gain(c *creature, xp float64) {
	if c.bot != nil {
		xp *= botXP
	}
	c.xp += xp
	c.progress += xp
}

func biteDamage(c *creature) float64 {
	return (30 + 4.5*float64(c.tier())) * (1 + levelBonus*float64(c.biteLv))
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
			if q.tier() > p.tier() {
				big, small = q, p
			}
			rb, rs := big.r(), small.r()
			d := math.Hypot(big.x-small.x, big.y-small.y)
			if d >= rb+rs || small.hidden || big.hidden && big.tier() == small.tier() {
				continue
			}
			switch {
			case big.tier() > small.tier():
				switch {
				case big.tier() == small.tier()+1 && small.dash > 0 && !small.bit && big.guard == 0:
					small.bit = true // a boost into the tier above bites before it can be eaten
					a.hurt(small, big, biteDamage(small)/2, 320)
				case small.guard == 0 && d < rb+rs*0.3:
					a.eat(big, small)
				case small.guard > 0:
					push(big, small, d, rb+rs)
				}
			default:
				if p.dash > 0 && !p.bit && q.guard == 0 {
					p.bit = true
					a.hurt(p, q, biteDamage(p), 320)
				}
				if q.dead == nil && q.dash > 0 && !q.bit && p.guard == 0 {
					q.bit = true
					a.hurt(q, p, biteDamage(q), 320)
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
	rp, rq := p.r(), q.r()
	wp := rq * rq / (rp*rp + rq*rq)
	p.x, p.y = p.x-nx*overlap*wp, p.y-ny*overlap*wp
	q.x, q.y = q.x+nx*overlap*(1-wp), q.y+ny*overlap*(1-wp)
}

// hurt takes dmg from the victim and knocks it away from `by` (toward it, for a negative knock); a hurt that empties
// its hp eats it.
func (a *arena) hurt(by, victim *creature, dmg, knock float64) {
	victim.hp -= dmg
	if d := math.Hypot(victim.x-by.x, victim.y-by.y); d > 0.001 {
		victim.vx += (victim.x - by.x) / d * knock
		victim.vy += (victim.y - by.y) / d * knock
	}
	if victim.hp <= 0 && victim.dead == nil {
		a.eat(by, victim)
	}
}

func (a *arena) eat(eater, prey *creature) {
	prey.dead = &death{By: eater.name, BySp: eater.sp, Sp: prey.sp, XP: prey.xp, Kills: prey.kills, Secs: a.clock - prey.born}
	a.gain(eater, 10+prey.xp*0.4)
	eater.hunger = min(maxHunger, eater.hunger+25+5*float64(prey.tier()))
	eater.hp = min(eater.maxHP(), eater.hp+0.15*eater.maxHP())
	eater.kills++
	a.eaten = append(a.eaten, eaten{id: prey.id, by: eater.id})
}

// dropMeat leaves a dead creature's meat where it fell.
func (a *arena) dropMeat(c *creature) {
	for range 2 + c.tier()/2 {
		a.food = append(a.food, &foodItem{id: a.id(), kind: meat, x: c.x + (a.rng.Float64()-0.5)*40, y: c.y + (a.rng.Float64()-0.5)*40})
	}
}

// metabolise burns hunger, heals or starves, and offers an evolution to whoever has gained enough. At the top of the
// chain, enough xp is a stat point instead. Old bots die.
func (a *arena) metabolise(dt float64) {
	for _, c := range a.creatures {
		if c.dead != nil {
			continue
		}
		top := c.maxHP()
		c.hunger -= (0.4 + 0.15*float64(c.tier())) * dt
		switch {
		case c.hunger <= 0:
			c.hunger = 0
			c.hp -= 0.06 * top * dt
		case c.hunger > 30:
			c.hp = min(top, c.hp+0.03*top*dt)
		}
		if c.hp <= 0 || c.bot != nil && a.clock-c.born > c.bot.lifespan {
			c.dead = &death{Sp: c.sp, XP: c.xp, Kills: c.kills, Secs: a.clock - c.born}
			a.dropMeat(c)
			continue
		}
		if need := tierNeed[c.tier()]; !c.offer && c.progress >= need {
			if len(c.kind().Next) == 0 {
				c.points++
				c.progress -= need
			} else {
				c.offer = true
			}
		}
	}
}

// restockBots brings in bots, a couple a second, until the arena is full again.
func (a *arena) restockBots(dt float64) {
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

// spawnBot adds a bot: most are small, a third live in the sea, and none starts above botTopTier.
func (a *arena) spawnBot() {
	r := a.rng.Float64()
	tier := int(r * r * r * float64(botTopTier+1))
	inSea := a.rng.Float64() < 0.3
	var pool []int
	for ; len(pool) == 0 && tier <= botTopTier; tier++ {
		for i, s := range speciesList {
			if s.Tier == tier && (s.Habitat == amph || (s.Habitat == sea) == inSea) {
				pool = append(pool, i)
			}
		}
	}
	sp := starter
	if len(pool) > 0 {
		sp = pool[a.rng.IntN(len(pool))]
	}
	if speciesList[sp].Habitat == land || speciesList[sp].Habitat == air {
		inSea = false
	}
	t := speciesList[sp].Tier
	b := &brain{heading: a.rng.Float64() * 2 * math.Pi, wary: 0.6 + a.rng.Float64()*0.5, bold: 0.2 + a.rng.Float64()*0.5, lifespan: 90 + a.rng.Float64()*180}
	c := a.add(a.botName(), sp, cumulativeXP(t)+a.rng.Float64()*tierNeed[t]*0.5, b, inSea)
	c.progress = c.xp - cumulativeXP(t)
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

func leader(cs []*creature) *creature {
	var top *creature
	for _, c := range cs {
		if c.dead == nil && (top == nil || c.xp > top.xp) {
			top = c
		}
	}
	return top
}
