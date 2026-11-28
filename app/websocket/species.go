package websocket

import (
	"fmt"
	"math"
)

// The food chain: prehistoric creatures up to tier 7, mythical ones above, up to tier 12 (as the game counts, from 1;
// tiers here count from 0). It is a tree: each species can evolve into any of its `next`, all one tier up. From the
// Millipede it splits into land, sea (through the Devil Frog) and air (through the Meganeura), and each line has
// species at home in each biome. Every species has an ability on its own key, besides the boost every creature has.

// Habitats: where a species moves well.
const (
	land = "land" // slow in water
	sea  = "sea"  // slow out of the sea
	amph = "amph" // at home on land and in water
	air  = "air"  // flies: nothing slows it
)

// Ability kinds.
const (
	charge = "charge" // a long dash that hurts what it hits
	stomp  = "stomp"  // hurts everything near and throws it back
	spit   = "spit"   // a shot that hurts the first creature it hits
	pull   = "pull"   // hurts everything near and drags it in
)

type ability struct {
	Name     string  `json:"name"`
	Kind     string  `json:"kind"`
	Style    string  `json:"style"`    // how it looks: dust, quake, roar, wind, fire, venom, ink, water, gaze, frost or storm
	Cooldown float64 `json:"cooldown"` // seconds
}

type species struct {
	Name      string  `json:"name"`
	Tier      int     `json:"tier"`
	HP        float64 `json:"hp"`    // health, full
	ATK       float64 `json:"atk"`   // what a bite takes, before levels
	R         float64 `json:"r"`     // radius, px
	Speed     float64 `json:"speed"` // px a second, at home
	View      float64 `json:"view"`  // the height of the world a player of it sees, px
	Habitat   string  `json:"habitat"`
	Home      string  `json:"home"`      // the biome it lives in: where its bots spawn
	Fireproof bool    `json:"fireproof"` // walks through lava unharmed
	Hides     bool    `json:"hides"`     // fits in bushes and kelp
	Next      []int   `json:"next"`      // what it can evolve into
	Ability   ability `json:"ability"`
	next      []string
}

// tierNeed is the xp a creature gains, at each tier, before it may evolve; the top tier gets a stat point instead.
var tierNeed = []float64{40, 80, 140, 220, 320, 480, 680, 950, 1300, 1700, 2200, 2500}

var tierR = []float64{14, 18, 22, 26, 31, 37, 44, 52, 61, 72, 84, 98}

// kind makes a species: its tier sets its size, health and bite, which hpMul and atkMul shift (tanks have more health
// and a weaker bite, hunters the other way), and speed shifts its pace.
func kind(name string, tier int, habitat, home string, speed, hpMul, atkMul float64, ab ability, next ...string) species {
	t := float64(tier)
	return species{
		Name: name, Tier: tier, HP: math.Round((100 + 20*t) * hpMul), ATK: math.Round((20 + 6*t) * atkMul),
		R: tierR[tier], Speed: 255 - 4*t + speed, View: 800 + 85*t, Habitat: habitat, Home: home,
		Hides: tier <= 3 && habitat != air, Ability: ab, Next: []int{}, next: next,
	}
}

// fireproof species walk through lava.
var fireproof = map[string]bool{"Salamander": true, "Dimetrodon": true, "Basilisk": true, "Dragon": true, "Phoenix": true, "Quetzalcoatl": true}

var speciesList = []species{
	// tier 1
	kind("Millipede", 0, land, meadow, 0, 1, 1, ability{"Scuttle", charge, "dust", 4}, "Devil Frog", "Compy", "Meganeura"),
	// tier 2
	kind("Devil Frog", 1, amph, swamp, -5, 1.05, 0.95, ability{"Tongue Spit", spit, "venom", 3.5}, "Ammonite", "Raptor", "Diplocaulus"),
	kind("Compy", 1, land, meadow, 12, 0.9, 1.1, ability{"Pounce", charge, "dust", 4}, "Raptor", "Glyptodon", "Salamander"),
	kind("Meganeura", 1, air, swamp, 10, 0.8, 1, ability{"Dart", charge, "wind", 3.5}, "Archaeopteryx"),
	// tier 3
	kind("Ammonite", 2, sea, oceanBiome, 0, 1.1, 0.9, ability{"Ink Jet", spit, "ink", 3.5}, "Dunkleosteus"),
	kind("Raptor", 2, land, meadow, 20, 0.9, 1.2, ability{"Pounce", charge, "dust", 4}, "Terror Bird", "Ankylosaurus", "Dimetrodon"),
	kind("Glyptodon", 2, land, meadow, -20, 1.3, 0.8, ability{"Shell Spin", stomp, "dust", 5}, "Ankylosaurus"),
	kind("Archaeopteryx", 2, air, meadow, 12, 0.8, 1, ability{"Wing Slash", charge, "wind", 4}, "Pteranodon", "Terror Bird"),
	kind("Salamander", 2, land, volcano, 0, 1, 1, ability{"Ember Spit", spit, "fire", 3.5}, "Dimetrodon"),
	kind("Diplocaulus", 2, amph, swamp, 0, 1.15, 0.9, ability{"Head Swipe", stomp, "water", 4.5}, "Dunkleosteus", "Dimetrodon"),
	// tier 4
	kind("Dunkleosteus", 3, sea, oceanBiome, 5, 1.1, 1.1, ability{"Crushing Lunge", charge, "water", 4.5}, "Plesiosaur", "Ichthyosaur"),
	kind("Terror Bird", 3, land, meadow, 18, 0.9, 1.2, ability{"Beak Dive", charge, "dust", 4.5}, "Sabertooth", "Triceratops"),
	kind("Ankylosaurus", 3, land, meadow, -18, 1.35, 0.85, ability{"Tail Club", stomp, "quake", 5}, "Triceratops", "Sabertooth", "Woolly Rhino"),
	kind("Pteranodon", 3, air, volcano, 10, 0.8, 1.05, ability{"Dive Bomb", charge, "wind", 4.5}, "Pelagornis"),
	kind("Dimetrodon", 3, land, volcano, -5, 1.1, 1, ability{"Heat Wave", stomp, "fire", 5}, "Triceratops", "Sabertooth"),
	// tier 5
	kind("Plesiosaur", 4, sea, oceanBiome, 5, 1, 1, ability{"Water Jet", spit, "water", 3.5}, "Megalodon", "Spinosaurus", "Sarcosuchus"),
	kind("Ichthyosaur", 4, sea, oceanBiome, 18, 0.9, 1.1, ability{"Torpedo", charge, "water", 4}, "Megalodon"),
	kind("Sabertooth", 4, land, tundra, 15, 0.9, 1.25, ability{"Saber Pounce", charge, "dust", 4.5}, "Spinosaurus", "Mammoth"),
	kind("Triceratops", 4, land, meadow, -8, 1.25, 0.95, ability{"Horn Charge", charge, "dust", 5}, "Mammoth"),
	kind("Woolly Rhino", 4, land, tundra, -6, 1.3, 0.95, ability{"Ram", charge, "frost", 5}, "Mammoth"),
	kind("Pelagornis", 4, air, oceanBiome, 10, 0.8, 1.05, ability{"Gale", pull, "wind", 5.5}, "Quetzalcoatlus"),
	// tier 6
	kind("Megalodon", 5, sea, oceanBiome, 15, 0.95, 1.25, ability{"Frenzy", charge, "water", 4.5}, "Mosasaur", "Livyatan"),
	kind("Spinosaurus", 5, amph, swamp, 0, 1.05, 1.05, ability{"Tail Slam", stomp, "water", 5}, "Mosasaur", "T-Rex", "Titanoboa"),
	kind("Mammoth", 5, land, tundra, -12, 1.3, 0.9, ability{"Stampede", stomp, "quake", 5.5}, "T-Rex", "Titanoboa", "Cave Bear"),
	kind("Quetzalcoatlus", 5, air, meadow, 8, 0.8, 1.1, ability{"Sky Strike", charge, "wind", 4.5}, "Argentavis"),
	kind("Sarcosuchus", 5, amph, swamp, -4, 1.15, 1.1, ability{"Death Roll", pull, "water", 5.5}, "Titanoboa", "Mosasaur"),
	// tier 7
	kind("Mosasaur", 6, sea, oceanBiome, 8, 1.05, 1.1, ability{"Whirlpool", pull, "water", 6}, "Sea Serpent"),
	kind("Livyatan", 6, sea, oceanBiome, 5, 1.2, 1.05, ability{"Sonar Blast", spit, "water", 3.5}, "Sea Serpent"),
	kind("T-Rex", 6, land, volcano, 0, 1, 1.25, ability{"Roar", stomp, "roar", 5.5}, "Griffin", "Basilisk"),
	kind("Titanoboa", 6, amph, swamp, -5, 1.15, 0.95, ability{"Constrict", pull, "venom", 6}, "Basilisk", "Sea Serpent"),
	kind("Cave Bear", 6, land, tundra, -4, 1.25, 1.05, ability{"Maul", stomp, "frost", 5}, "Yeti"),
	kind("Argentavis", 6, air, volcano, 8, 0.8, 1.1, ability{"Downdraft", stomp, "wind", 5}, "Griffin"),
	// tier 8: the mythical ones begin
	kind("Sea Serpent", 7, sea, oceanBiome, 10, 1, 1.1, ability{"Venom Spit", spit, "venom", 3}, "Kraken", "Hydra"),
	kind("Griffin", 7, air, meadow, 15, 0.85, 1.15, ability{"Talon Dive", charge, "wind", 4.5}, "Behemoth", "Hydra", "Roc"),
	kind("Basilisk", 7, land, volcano, 5, 1, 1.1, ability{"Deadly Gaze", spit, "gaze", 3.5}, "Hydra", "Behemoth"),
	kind("Yeti", 7, land, tundra, 0, 1.2, 1.05, ability{"Avalanche", stomp, "frost", 5.5}, "Fenrir", "Behemoth"),
	// tier 9
	kind("Kraken", 8, sea, oceanBiome, 0, 1.2, 1, ability{"Tentacle Grab", pull, "ink", 5.5}, "Leviathan"),
	kind("Hydra", 8, amph, swamp, 0, 1.15, 1.05, ability{"Acid Spit", spit, "venom", 3}, "Leviathan", "Dragon"),
	kind("Behemoth", 8, land, volcano, -10, 1.35, 0.95, ability{"Earthquake", stomp, "quake", 6}, "Dragon", "Jotunn"),
	kind("Roc", 8, air, meadow, 12, 0.85, 1.15, ability{"Storm Dive", charge, "wind", 4.5}, "Thunderbird"),
	kind("Fenrir", 8, land, tundra, 12, 1, 1.25, ability{"Ravage", charge, "frost", 4.5}, "Jotunn"),
	// tier 10
	kind("Leviathan", 9, sea, oceanBiome, 5, 1.2, 1.1, ability{"Maelstrom", pull, "water", 6}, "Jormungandr"),
	kind("Dragon", 9, air, volcano, 10, 1.05, 1.2, ability{"Fire Breath", spit, "fire", 3}, "Phoenix", "Frost Wyrm"),
	kind("Thunderbird", 9, air, meadow, 14, 0.9, 1.15, ability{"Lightning", spit, "storm", 3}, "Phoenix"),
	kind("Jotunn", 9, land, tundra, -6, 1.35, 1, ability{"Glacier Slam", stomp, "frost", 6}, "Frost Wyrm"),
	// tier 11
	kind("Jormungandr", 10, sea, oceanBiome, 5, 1.25, 1.1, ability{"Coil Crush", pull, "venom", 5.5}, "Tiamat"),
	kind("Phoenix", 10, air, volcano, 12, 1, 1.2, ability{"Inferno", spit, "fire", 2.5}, "Quetzalcoatl"),
	kind("Frost Wyrm", 10, land, tundra, 4, 1.2, 1.15, ability{"Frost Breath", spit, "frost", 3}, "Ymir"),
	// tier 12: the top
	kind("Tiamat", 11, sea, oceanBiome, 5, 1.3, 1.15, ability{"Chaos Tide", pull, "water", 5}),
	kind("Quetzalcoatl", 11, air, meadow, 12, 1.05, 1.2, ability{"Sun Serpent", charge, "fire", 4}),
	kind("Ymir", 11, land, tundra, -4, 1.4, 1.1, ability{"World Quake", stomp, "quake", 6}),
}

// starter is what every player begins as.
const starter = 0

func init() {
	index := map[string]int{}
	for i, s := range speciesList {
		index[s.Name] = i
	}
	for i := range speciesList {
		s := &speciesList[i]
		s.Fireproof = fireproof[s.Name]
		for _, n := range s.next {
			j, ok := index[n]
			if !ok || speciesList[j].Tier != s.Tier+1 {
				panic(fmt.Sprintf("%s cannot evolve into %q", s.Name, n))
			}
			s.Next = append(s.Next, j)
		}
	}
}

// cumulativeXP is the least xp a creature that evolved straight to `tier` has.
func cumulativeXP(tier int) float64 {
	total := 0.0
	for _, n := range tierNeed[:tier] {
		total += n
	}
	return total
}
