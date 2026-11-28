package websocket

import (
	"math"
	"slices"
)

// Biomes: the world is split into five, each with its own ground, terrain, food and creatures at home in it. The
// Ashen Peaks (volcano) run along the north, with lava that hurts anything not fireproof to stand in; Frostmarch
// (tundra) along the south, with ice that sends all but its own creatures sliding; Mirewood (swamp) in the west,
// thick with tar and murky ponds; the Fernlands (meadow) in the middle; and the sea in the east. The borders wave,
// and the client draws them from the same lines the server uses (`edges`).

const (
	meadow     = "meadow"
	swamp      = "swamp"
	volcano    = "volcano"
	tundra     = "tundra"
	oceanBiome = "ocean"
	edgeStep   = 200.0 // px between the points of a biome border
	lavaBurn   = 0.12  // the share of its health a creature loses a second in lava
)

// biomeShare is roughly how much of the world each biome is, for spreading bots.
var biomeShare = map[string]float64{meadow: 0.28, swamp: 0.18, volcano: 0.15, tundra: 0.17, oceanBiome: 0.22}

// looseFood is what grows loose in each biome, and its share there.
var looseFood = map[string][]struct {
	name  string
	share float64
}{
	meadow:     {{"berry", 0.5}, {"mushroom", 0.3}, {"egg", 0.2}},
	swamp:      {{"mushroom", 0.45}, {"fernhead", 0.4}, {"berry", 0.15}},
	volcano:    {{"emberberry", 0.6}, {"egg", 0.25}, {"mushroom", 0.15}},
	tundra:     {{"frostberry", 0.55}, {"pinecone", 0.45}},
	oceanBiome: {{"krill", 0.55}, {"clam", 0.3}, {"fish", 0.15}},
}

// foodTarget is how much loose food each biome grows back to.
var foodTarget = map[string]int{meadow: 420, swamp: 260, volcano: 220, tundra: 240, oceanBiome: 520}

// edges are the biome borders: the volcano's southern edge and the tundra's northern one as y at x = i*edgeStep,
// and the swamp's eastern edge as x at y = i*edgeStep.
type edges struct {
	Volcano []float64 `json:"volcano"`
	Tundra  []float64 `json:"tundra"`
	Swamp   []float64 `json:"swamp"`
	Step    float64   `json:"step"`
}

func wave(a *arena, n int, base, at float64) []float64 {
	p1, p2 := a.rng.Float64()*6, a.rng.Float64()*6
	out := make([]float64, n)
	for i := range out {
		v := float64(i) * edgeStep
		out[i] = base + 160*math.Sin(v/at+p1) + 60*math.Sin(v/(at/3)+p2)
	}
	return out
}

func (a *arena) makeEdges() {
	a.edges = edges{
		Volcano: wave(a, int(worldW/edgeStep)+2, 1900, 800),
		Tundra:  wave(a, int(worldW/edgeStep)+2, 6100, 850),
		Swamp:   wave(a, int(worldH/edgeStep)+2, 2500, 700),
		Step:    edgeStep,
	}
}

func along(line []float64, v float64) float64 {
	f := max(0, v) / edgeStep
	i := min(int(f), len(line)-2)
	return line[i] + (line[i+1]-line[i])*(f-float64(i))
}

// biomeAt is the biome at x, y. Islands count as meadow.
func (a *arena) biomeAt(x, y float64) string {
	switch {
	case x > a.coastX(y) && inside(a.islands, x, y) == nil:
		return oceanBiome
	case y < along(a.edges.Volcano, x):
		return volcano
	case y > along(a.edges.Tundra, x):
		return tundra
	case x < along(a.edges.Swamp, y):
		return swamp
	}
	return meadow
}

// pointIn is a random point in a biome on open ground (or open sea), or false if a few tries find none.
func (a *arena) pointIn(biome string, margin float64) (float64, float64, bool) {
	for range 40 {
		x, y := margin+a.rng.Float64()*(worldW-2*margin), margin+a.rng.Float64()*(worldH-2*margin)
		if a.biomeAt(x, y) != biome {
			continue
		}
		if t := a.terrain(x, y); (t == ocean) != (biome == oceanBiome) || t == pond {
			continue
		}
		if inside(a.lava, x, y) != nil || inside(a.tar, x, y) != nil {
			continue
		}
		return x, y, true
	}
	return 0, 0, false
}

// in is a scatter test: a circle that lies well inside one biome.
func (a *arena) in(biome string) func(x, y, r float64) bool {
	return func(x, y, r float64) bool {
		for _, d := range [][2]float64{{0, 0}, {r, 0}, {-r, 0}, {0, r}, {0, -r}} {
			if a.biomeAt(x+d[0], y+d[1]) != biome {
				return false
			}
		}
		if biome == oceanBiome {
			return x-r-220 > a.coastX(y)
		}
		return x+r+220 < a.coastX(y)
	}
}

// makeMap lays out the world: the coast and the biome borders, then each biome's terrain and food sources.
func (a *arena) makeMap() {
	p1, p2 := a.rng.Float64()*6, a.rng.Float64()*6
	for y := 0.0; y <= worldH+coastStep; y += coastStep {
		a.coast = append(a.coast, 7600+260*math.Sin(y/1100+p1)+120*math.Sin(y/380+p2))
	}
	a.makeEdges()
	m, sw, vo, tu, oc := a.in(meadow), a.in(swamp), a.in(volcano), a.in(tundra), a.in(oceanBiome)
	taken := func() []circle { return slices.Concat(a.ponds, a.tar, a.lava, a.ice, a.bushes, a.rocks) }
	a.ponds = slices.Concat(a.scatter(6, 140, 280, nil, m), a.scatter(10, 130, 260, nil, sw))
	a.lava = a.scatter(12, 110, 230, nil, vo)
	a.ice = a.scatter(12, 160, 320, nil, tu)
	a.tar = slices.Concat(a.scatter(2, 110, 180, taken(), m), a.scatter(7, 110, 200, taken(), sw), a.scatter(3, 100, 160, taken(), vo))
	a.bushes = slices.Concat(a.scatter(70, 55, 95, taken(), m), a.scatter(60, 60, 105, taken(), sw), a.scatter(20, 50, 80, taken(), vo), a.scatter(35, 55, 95, taken(), tu))
	a.rocks = slices.Concat(a.scatter(18, 60, 110, taken(), m), a.scatter(18, 60, 110, taken(), vo), a.scatter(16, 60, 110, taken(), tu), a.scatter(6, 60, 100, taken(), sw))
	a.islands = a.scatter(7, 220, 380, nil, func(x, y, r float64) bool { return x-r-350 > a.coastX(y) })
	for _, isl := range a.islands { // each island has a fern, a rock and (in placeSources) a ginkgo tree
		at := a.rng.Float64() * 2 * math.Pi
		spot := func(k float64) (float64, float64) {
			return isl.X + math.Cos(at+k*2.1)*isl.R*0.45, isl.Y + math.Sin(at+k*2.1)*isl.R*0.45
		}
		x, y := spot(0)
		a.bushes = append(a.bushes, circle{X: x, Y: y, R: 55 + a.rng.Float64()*15})
		x, y = spot(1)
		a.rocks = append(a.rocks, circle{X: x, Y: y, R: 55 + a.rng.Float64()*20})
	}
	a.kelp = a.scatter(50, 60, 110, a.islands, oc)
	a.reefs = a.scatter(24, 60, 100, slices.Concat(a.islands, a.kelp), oc)
	a.placeSources(map[string]func(x, y, r float64) bool{meadow: m, swamp: sw, volcano: vo, tundra: tu, oceanBiome: oc})
}

// lavaBurns hurts a creature standing in lava, unless it flies or is fireproof; it reports whether it did.
func (a *arena) lavaBurns(c *creature, dt float64) bool {
	if c.kind().Habitat == air || c.kind().Fireproof || inside(a.lava, c.x, c.y) == nil {
		return false
	}
	c.hp -= lavaBurn * c.maxHP() * dt
	c.hurtAt = a.clock
	return true
}

// onIce says whether a creature slides: on ice, unless it flies or the tundra is its home.
func (a *arena) onIce(c *creature) bool {
	return c.kind().Habitat != air && c.kind().Home != tundra && inside(a.ice, c.x, c.y) != nil
}
