package websocket

import (
	"math"
	"slices"
)

// Terrain that keeps some creatures safe from others, and the places food grows from.
//
// Crags (rocks on land, reefs at sea) are too high or tight for anything big: only climbers, creatures up to
// climbTier (tier 4 as the game counts, from 1) and fliers, can get onto one, and everything else is pushed back to its edge, so a small creature well onto
// a crag is out of reach of the big ones below. Tar pits bog down anything big that walks into them while the small
// ones skitter across. Islands are land out at sea: sea creatures are stranded on them, and land creatures have to
// crawl through the sea to get there.
//
// Food sources grow their own food around them, up to a few at a time: ginkgo trees drop nuts, termite mounds swarm,
// nests lay eggs, the bones of a fallen giant still give meat, ponds grow lilies, fishing holes in the tundra ice
// give fish, and vents in the sea feed shrimp.
// Now and then a starfruit ripens somewhere on land: rare, and worth a lot to anyone.

const (
	climbTier    = 3    // the biggest tier that climbs crags (counting from 0)
	tarPace      = 0.35 // the share of its speed a big creature keeps in tar
	tarSmallPace = 0.9  // and a small one
	starfruits   = 3    // the most starfruit ripe at once
	starfruitDue = 20.0 // seconds between starfruit
)

// source is a place that grows food: its kind says which and how fast.
type source struct {
	Kind  string  `json:"kind"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	R     float64 `json:"r"`
	timer float64
	count int // its food lying about now
}

type sourceKind struct {
	food   string
	max    int     // the most of its food about at once
	every  float64 // seconds between new food
	spread float64 // how far out its food lands, in its radii
	on     bool    // its food lands on it, not round it
}

var sourceKinds = map[string]sourceKind{
	"tree":   {food: "ginkgo", max: 6, every: 3, spread: 1.4},
	"mound":  {food: "termites", max: 10, every: 1.2, spread: 1.8},
	"nest":   {food: "egg", max: 3, every: 6, spread: 1},
	"bones":  {food: "meat", max: 4, every: 5, spread: 0.9, on: true}, // meat lies on the carcass
	"vent":   {food: "shrimp", max: 8, every: 1.5, spread: 1.8},
	"hole":   {food: "fish", max: 3, every: 4, spread: 1.6},
	"lilies": {food: "lily", max: 4, every: 4, spread: 0.8, on: true},
}

func foodIndex(name string) int {
	return slices.IndexFunc(foodKinds, func(k foodKind) bool { return k.Name == name })
}

// climbs says whether a creature can get onto crags.
func climbs(c *creature) bool {
	return c.tier() <= climbTier || c.kind().Habitat == air
}

func inside(set []circle, x, y float64) *circle {
	for i := range set {
		if c := &set[i]; math.Abs(x-c.X) < c.R && math.Hypot(x-c.X, y-c.Y) < c.R {
			return c
		}
	}
	return nil
}

// keepOffCrags pushes a creature that cannot climb back to the edge of any crag it got onto.
func (a *arena) keepOffCrags(c *creature) {
	if climbs(c) {
		return
	}
	for _, set := range [][]circle{a.rocks, a.reefs} {
		for _, k := range set {
			d := math.Hypot(c.x-k.X, c.y-k.Y)
			if d >= k.R {
				continue
			}
			nx, ny := 1.0, 0.0
			if d > 0.001 {
				nx, ny = (c.x-k.X)/d, (c.y-k.Y)/d
			}
			c.x, c.y = k.X+nx*k.R, k.Y+ny*k.R
			if dot := c.vx*nx + c.vy*ny; dot < 0 { // stop it pressing in
				c.vx, c.vy = c.vx-dot*nx, c.vy-dot*ny
			}
		}
	}
}

// tarPaceOf is the share of its speed a creature keeps where it is: less in tar, the more so if it is big.
func (a *arena) tarPaceOf(c *creature) float64 {
	if c.kind().Habitat == air || inside(a.tar, c.x, c.y) == nil {
		return 1
	}
	if c.tier() <= climbTier {
		return tarSmallPace
	}
	return tarPace
}

// placeSources puts the food sources about the map, by biome: ginkgo trees in the meadow and swamp, termite mounds,
// nests in the meadow and the volcano, a fallen giant's bones mostly where the big ones die, fishing holes in the
// tundra ice, vents at sea; a ginkgo on every island, and lilies in every pond.
func (a *arena) placeSources(in map[string]func(x, y, r float64) bool) {
	clearOf := func(ok func(x, y, r float64) bool) func(x, y, r float64) bool {
		return func(x, y, r float64) bool {
			return ok(x, y, r) && inside(a.ponds, x, y) == nil && inside(a.tar, x, y) == nil && inside(a.lava, x, y) == nil && inside(a.ice, x, y) == nil
		}
	}
	taken := slices.Concat(a.ponds, a.tar, a.lava, a.bushes, a.rocks)
	for _, spec := range []struct {
		kind, biome string
		n           int
		minR, maxR  float64
	}{
		{"tree", meadow, 18, 45, 60}, {"tree", swamp, 10, 45, 60},
		{"mound", meadow, 10, 22, 30}, {"mound", swamp, 6, 22, 30}, {"mound", volcano, 5, 22, 30},
		{"nest", meadow, 8, 20, 26}, {"nest", volcano, 8, 20, 26},
		{"bones", volcano, 6, 75, 95}, {"bones", tundra, 4, 75, 95}, {"bones", meadow, 3, 75, 95},
		{"hole", tundra, 10, 20, 28}, {"vent", oceanBiome, 20, 22, 32},
	} {
		ok := clearOf(in[spec.biome])
		if spec.kind == "hole" { // fishing holes are cut in the ice
			ok = func(x, y, r float64) bool { return in[tundra](x, y, r) && inside(a.ice, x, y) != nil }
		}
		for _, c := range a.scatter(spec.n, spec.minR, spec.maxR, taken, ok) {
			a.sources = append(a.sources, &source{Kind: spec.kind, X: c.X, Y: c.Y, R: c.R})
			taken = append(taken, c)
		}
	}
	for _, isl := range a.islands { // opposite the island's fern and rock
		var fern circle
		for _, b := range a.bushes {
			if math.Hypot(b.X-isl.X, b.Y-isl.Y) < isl.R {
				fern = b
			}
		}
		at := math.Atan2(fern.Y-isl.Y, fern.X-isl.X) + 2*2.1
		a.sources = append(a.sources, &source{Kind: "tree", X: isl.X + math.Cos(at)*isl.R*0.45, Y: isl.Y + math.Sin(at)*isl.R*0.45, R: 50})
	}
	for _, p := range a.ponds {
		a.sources = append(a.sources, &source{Kind: "lilies", X: p.X, Y: p.Y, R: p.R})
	}
}

// growSources lets each source grow its food when it is due, and ripens starfruit now and then.
func (a *arena) growSources(dt float64) {
	for _, s := range a.sources {
		k := sourceKinds[s.Kind]
		if s.timer += dt; s.timer < k.every || s.count >= k.max {
			continue
		}
		s.timer = 0
		for range 10 {
			ang := a.rng.Float64() * 2 * math.Pi
			d := s.R * (0.8 + a.rng.Float64()*(k.spread-0.8))
			if k.on {
				d = s.R * a.rng.Float64() * k.spread
			}
			x, y := s.X+math.Cos(ang)*d, s.Y+math.Sin(ang)*d
			if x < 20 || y < 20 || x > worldW-20 || y > worldH-20 {
				continue
			}
			a.food = append(a.food, &foodItem{id: a.id(), kind: foodIndex(k.food), x: x, y: y, src: s})
			s.count++
			break
		}
	}
	if a.starTimer += dt; a.starTimer >= starfruitDue {
		a.starTimer = 0
		ripe := 0
		star := foodIndex("starfruit")
		for _, f := range a.food {
			if f.kind == star {
				ripe++
			}
		}
		for tries := 0; ripe < starfruits && tries < 20; tries++ {
			x, y := 100+a.rng.Float64()*(worldW-200), 100+a.rng.Float64()*(worldH-200)
			if a.terrain(x, y) == ground && inside(a.tar, x, y) == nil && inside(a.lava, x, y) == nil {
				a.food = append(a.food, &foodItem{id: a.id(), kind: star, x: x, y: y})
				break
			}
		}
	}
}
