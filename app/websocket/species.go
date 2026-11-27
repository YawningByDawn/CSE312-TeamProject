package websocket

import (
	"fmt"
	"math"
)

// The food chain: prehistoric creatures up to tier 6, mythical ones above. It is a tree: each species can evolve into
// any of its `next`, all one tier up, and the paths split between land and sea at the Devil Frog. Every species has an
// ability on its own key, besides the boost every creature has.

// Habitats: where a species moves well.
const (
	land = "land" // slow in water
	sea  = "sea"  // slow out of the sea
	amph = "amph" // at home on land and in water
	air  = "air"  // flies: nothing slows it
)

// Ability kinds.
const (
	charge = "charge" // a long dash that hurts the first creature it hits
	stomp  = "stomp"  // hurts everything near and throws it back
	spit   = "spit"   // a shot that hurts the first creature it hits
	pull   = "pull"   // hurts everything near and drags it in
)

type ability struct {
	Name     string  `json:"name"`
	Kind     string  `json:"kind"`
	Style    string  `json:"style"`    // how it looks: dust, quake, roar, wind, fire, venom, ink, water or gaze
	Cooldown float64 `json:"cooldown"` // seconds
}

type species struct {
	Name    string  `json:"name"`
	Tier    int     `json:"tier"`
	HP      float64 `json:"hp"`    // health, full
	ATK     float64 `json:"atk"`   // what a bite takes, before levels
	R       float64 `json:"r"`     // radius, px
	Speed   float64 `json:"speed"` // px a second, at home
	View    float64 `json:"view"`  // the height of the world a player of it sees, px
	Habitat string  `json:"habitat"`
	Hides   bool    `json:"hides"` // fits in bushes and kelp
	Next    []int   `json:"next"`  // what it can evolve into
	Ability ability `json:"ability"`
	next    []string
}

// tierNeed is the xp a creature gains, at each tier, before it may evolve; the top tier gets a stat point instead.
var tierNeed = []float64{40, 80, 140, 220, 320, 480, 680, 950, 1300, 1500}

var tierR = []float64{14, 18, 22, 26, 31, 37, 44, 52, 61, 72}

// kind makes a species: its tier sets its size, health and bite, which hpMul and atkMul shift (tanks have more health
// and a weaker bite, hunters the other way), and speed shifts its pace.
func kind(name string, tier int, habitat string, speed, hpMul, atkMul float64, ab ability, next ...string) species {
	t := float64(tier)
	return species{
		Name: name, Tier: tier, HP: math.Round((100 + 20*t) * hpMul), ATK: math.Round((20 + 6*t) * atkMul),
		R: tierR[tier], Speed: 255 - 4*t + speed, View: 800 + 85*t,
		Habitat: habitat, Hides: tier <= 3 && habitat != air, Ability: ab, Next: []int{}, next: next,
	}
}

var speciesList = []species{
	kind("Millipede", 0, land, 0, 1, 1, ability{"Scuttle", charge, "dust", 4}, "Devil Frog", "Compy"),
	kind("Devil Frog", 1, amph, -5, 1.05, 0.95, ability{"Tongue Spit", spit, "venom", 3.5}, "Ammonite", "Raptor"),
	kind("Compy", 1, land, 12, 0.9, 1.1, ability{"Pounce", charge, "dust", 4}, "Raptor", "Glyptodon"),
	kind("Ammonite", 2, sea, 0, 1.1, 0.9, ability{"Ink Jet", spit, "ink", 3.5}, "Dunkleosteus"),
	kind("Raptor", 2, land, 20, 0.9, 1.2, ability{"Pounce", charge, "dust", 4}, "Terror Bird", "Ankylosaurus"),
	kind("Glyptodon", 2, land, -20, 1.3, 0.8, ability{"Shell Spin", stomp, "dust", 5}, "Ankylosaurus"),
	kind("Dunkleosteus", 3, sea, 5, 1.1, 1.1, ability{"Crushing Lunge", charge, "water", 4.5}, "Plesiosaur"),
	kind("Terror Bird", 3, land, 18, 0.9, 1.2, ability{"Beak Dive", charge, "dust", 4.5}, "Sabertooth", "Triceratops"),
	kind("Ankylosaurus", 3, land, -18, 1.35, 0.85, ability{"Tail Club", stomp, "quake", 5}, "Triceratops", "Sabertooth"),
	kind("Plesiosaur", 4, sea, 5, 1, 1, ability{"Water Jet", spit, "water", 3.5}, "Megalodon", "Spinosaurus"),
	kind("Sabertooth", 4, land, 15, 0.9, 1.25, ability{"Saber Pounce", charge, "dust", 4.5}, "Spinosaurus", "Mammoth"),
	kind("Triceratops", 4, land, -8, 1.25, 0.95, ability{"Horn Charge", charge, "dust", 5}, "Mammoth"),
	kind("Megalodon", 5, sea, 15, 0.95, 1.25, ability{"Frenzy", charge, "water", 4.5}, "Mosasaur"),
	kind("Spinosaurus", 5, amph, 0, 1.05, 1.05, ability{"Tail Slam", stomp, "water", 5}, "Mosasaur", "T-Rex", "Titanoboa"),
	kind("Mammoth", 5, land, -12, 1.3, 0.9, ability{"Stampede", stomp, "quake", 5.5}, "T-Rex", "Titanoboa"),
	kind("Mosasaur", 6, sea, 8, 1.05, 1.1, ability{"Whirlpool", pull, "water", 6}, "Sea Serpent"),
	kind("T-Rex", 6, land, 0, 1, 1.25, ability{"Roar", stomp, "roar", 5.5}, "Griffin", "Basilisk"),
	kind("Titanoboa", 6, amph, -5, 1.15, 0.95, ability{"Constrict", pull, "venom", 6}, "Basilisk", "Sea Serpent"),
	kind("Sea Serpent", 7, sea, 10, 1, 1.1, ability{"Venom Spit", spit, "venom", 3}, "Kraken", "Hydra"),
	kind("Griffin", 7, air, 15, 0.9, 1.15, ability{"Talon Dive", charge, "wind", 4.5}, "Behemoth", "Hydra"),
	kind("Basilisk", 7, land, 5, 1, 1.1, ability{"Deadly Gaze", spit, "gaze", 3.5}, "Hydra", "Behemoth"),
	kind("Kraken", 8, sea, 0, 1.2, 1, ability{"Tentacle Grab", pull, "ink", 5.5}, "Leviathan"),
	kind("Hydra", 8, amph, 0, 1.15, 1.05, ability{"Acid Spit", spit, "venom", 3}, "Leviathan", "Dragon"),
	kind("Behemoth", 8, land, -10, 1.35, 0.95, ability{"Earthquake", stomp, "quake", 6}, "Dragon"),
	kind("Leviathan", 9, sea, 5, 1.2, 1.1, ability{"Maelstrom", pull, "water", 6}),
	kind("Dragon", 9, air, 10, 1.05, 1.2, ability{"Fire Breath", spit, "fire", 3}),
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
