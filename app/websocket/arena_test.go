package websocket

import (
	"encoding/json"
	"math"
	"math/rand/v2"
	"testing"
)

// newTestArena is an empty meadow: no food, bots, bushes or ponds, and nothing grows back.
func newTestArena() *arena {
	a := newArena(rand.New(rand.NewPCG(1, 2)), 20)
	a.creatures, a.food, a.bushes, a.ponds = nil, nil, nil, nil
	a.foodTarget, a.minBots, a.totalCreatures = 0, 0, 0
	return a
}

// put adds a player's creature of tier sp at x, y, with no spawn protection.
func put(a *arena, name string, sp int, x, y float64) *creature {
	c := a.spawn(name)
	c.sp, c.xp, c.x, c.y, c.guard = sp, speciesList[sp].XP, x, y, 0
	return c
}

func TestTheFoodChainGrows(t *testing.T) {
	for i := 1; i < len(speciesList); i++ {
		p, q := speciesList[i-1], speciesList[i]
		if q.R <= p.R || q.XP <= p.XP || q.View <= p.View {
			t.Fatalf("%s is not bigger than %s", q.Name, p.Name)
		}
	}
}

func TestABiggerCreatureEatsASmallerOneItCatches(t *testing.T) {
	a := newTestArena()
	wolf := put(a, "ann", 6, 1000, 1000)
	hare := put(a, "bea", 2, 1030, 1000)
	a.step(0.05)
	if hare.dead == nil || hare.dead.By != "ann" {
		t.Fatalf("the hare is alive, or eaten by the wrong one: %+v", hare.dead)
	}
	if wolf.kills != 1 || wolf.xp <= speciesList[6].XP {
		t.Fatalf("the wolf got nothing: kills %d, xp %v", wolf.kills, wolf.xp)
	}
	if len(a.creatures) != 1 {
		t.Fatalf("%d creatures left, want 1", len(a.creatures))
	}
}

func TestSpawnProtectionKeepsANewCreatureFromBeingEaten(t *testing.T) {
	a := newTestArena()
	put(a, "ann", 6, 1000, 1000)
	beetle := a.spawn("bea")
	beetle.x, beetle.y = 1010, 1000
	a.step(0.05)
	if beetle.dead != nil {
		t.Fatal("a protected beetle was eaten")
	}
}

func TestCreaturesOfOneTierPushApartAndOnlyBiteWithABoost(t *testing.T) {
	a := newTestArena()
	p := put(a, "ann", 4, 1000, 1000)
	q := put(a, "bea", 4, 1030, 1000)
	a.step(0.05)
	if p.dead != nil || q.dead != nil {
		t.Fatal("one boar ate another")
	}
	if d := math.Hypot(p.x-q.x, p.y-q.y); d < 2*speciesList[4].R-0.01 {
		t.Fatalf("still overlapping: %v apart", d)
	}
	if p.hp != maxHP || q.hp != maxHP {
		t.Fatalf("hp %v and %v without a bite", p.hp, q.hp)
	}
	q.x, q.y = 1040, 1000
	p.angle = 0
	a.boost(p)
	a.step(0.05)
	if q.hp >= maxHP || p.hp != maxHP {
		t.Fatalf("after ann's boost: ann %v hp, bea %v hp", p.hp, q.hp)
	}
}

func TestBitesThatEmptyHPEatTheVictim(t *testing.T) {
	a := newTestArena()
	p := put(a, "ann", 4, 1000, 1000)
	q := put(a, "bea", 4, 1040, 1000)
	q.hp = 10
	a.boost(p)
	a.step(0.05)
	if q.dead == nil || q.dead.By != "ann" {
		t.Fatal("a bite that emptied bea's hp did not eat her")
	}
}

func TestABushHidesSmallCreatures(t *testing.T) {
	a := newTestArena()
	a.bushes = []circle{{X: 1000, Y: 1000, R: 80}}
	put(a, "ann", 6, 1010, 1000)
	hare := put(a, "bea", 2, 1000, 1000)
	a.step(0.05)
	if !hare.hidden || hare.dead != nil {
		t.Fatalf("the hare in the bush: hidden %v, dead %v", hare.hidden, hare.dead)
	}
	boar := put(a, "cy", 4, 3000, 3000)
	boar.x, boar.y = 1000, 1000
	a.step(0.05)
	if boar.hidden {
		t.Fatal("a boar hid in a bush")
	}
}

func TestFrogsHideUnderWater(t *testing.T) {
	a := newTestArena()
	a.ponds = []circle{{X: 1000, Y: 1000, R: 200}}
	frog := put(a, "ann", 1, 1000, 1000)
	put(a, "bea", 5, 1010, 1000)
	a.step(0.05)
	if !frog.hidden || frog.dead != nil {
		t.Fatalf("the frog in the pond: hidden %v, dead %v", frog.hidden, frog.dead)
	}
}

func TestFoodFeedsAndEvolves(t *testing.T) {
	a := newTestArena()
	c := put(a, "ann", 0, 1000, 1000)
	c.xp = speciesList[1].XP - 1
	a.food = []*foodItem{{id: a.id(), kind: 2, x: 1005, y: 1000}}
	a.step(0.05)
	if len(a.food) != 0 {
		t.Fatal("the apple is still there")
	}
	if c.sp != 1 {
		t.Fatalf("tier %d after the apple, want 1", c.sp)
	}
	if len(a.eaten) != 1 || !a.eaten[0].food || a.eaten[0].by != c.id {
		t.Fatalf("eaten %+v", a.eaten)
	}
}

func TestStarvingCostsHPAndDropsMeat(t *testing.T) {
	a := newTestArena()
	c := put(a, "ann", 4, 1000, 1000)
	c.hunger, c.hp = 0, 1
	a.step(0.5)
	if c.dead == nil || c.dead.By != "" {
		t.Fatalf("death %+v, want starved", c.dead)
	}
	if len(a.food) != 4 {
		t.Fatalf("%d meat, want 4", len(a.food))
	}
	for _, f := range a.food {
		if f.kind != meat {
			t.Fatalf("food of kind %d", f.kind)
		}
	}
}

func TestBoostsCostHungerAndCoolDown(t *testing.T) {
	a := newTestArena()
	c := put(a, "ann", 0, 1000, 1000)
	h := c.hunger
	a.boost(c)
	a.boost(c)
	if c.hunger != h-boostCost || c.dash != boostTime {
		t.Fatalf("hunger %v, dash %v", c.hunger, c.dash)
	}
}

func TestCreaturesStayInTheWorld(t *testing.T) {
	a := newTestArena()
	c := put(a, "ann", 3, 20, 20)
	c.dx, c.dy = -1, -1
	for range 40 {
		a.step(0.05)
	}
	if r := speciesList[3].R; c.x < r || c.y < r {
		t.Fatalf("at %v, %v", c.x, c.y)
	}
}

// A full arena runs for a few simulated minutes: bots come and go, nothing leaves the world or turns NaN.
func TestAFullArenaRuns(t *testing.T) {
	a := newArena(rand.New(rand.NewPCG(3, 4)), 20)
	ann := a.spawn("ann")
	ann.dx = 1
	for i := range 4000 {
		a.step(0.05)
		for _, c := range a.creatures {
			r := speciesList[c.sp].R
			if math.IsNaN(c.x) || math.IsNaN(c.y) || c.x < r-0.01 || c.y < r-0.01 || c.x > worldW-r+0.01 || c.y > worldH-r+0.01 {
				t.Fatalf("step %d: %s at %v, %v", i, c.name, c.x, c.y)
			}
		}
	}
	if len(a.creatures) < a.minBots || len(a.food) < a.foodTarget/2 {
		t.Fatalf("%d creatures and %d food after the run", len(a.creatures), len(a.food))
	}
}

func TestTheViewIsJSONAndOnlyWhatIsNear(t *testing.T) {
	a := newTestArena()
	c := put(a, "ann", 0, 1000, 1000)
	put(a, "bea", 0, 1100, 1000)
	put(a, "cy", 0, 3900, 3900)
	a.food = []*foodItem{{id: a.id(), kind: 0, x: 1200, y: 1000}, {id: a.id(), kind: 1, x: 3800, y: 3800}}
	a.step(0.05)
	var got struct {
		Type string
		Me   struct {
			Alive bool
			ID    int
		}
		C  [][]any
		F  [][]int
		E  [][]int
		LB []boardEntry
	}
	data := a.view(viewer{cr: c})
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("%v in %s", err, data)
	}
	if got.Type != "state" || !got.Me.Alive || got.Me.ID != c.id || len(got.C) != 2 || len(got.F) != 1 || len(got.LB) != 3 {
		t.Fatalf("view %s", data)
	}
}

func TestADeadPlayersViewSaysWhoAteThem(t *testing.T) {
	a := newTestArena()
	data := a.view(viewer{died: &death{By: "<b>", BySp: 6, Sp: 2, XP: 150, Secs: 61}, camX: 500, camY: 500})
	var got struct {
		Me struct {
			Alive bool
			By    string
			XP    int
		}
	}
	if err := json.Unmarshal(data, &got); err != nil || got.Me.Alive || got.Me.By != "&lt;b&gt;" || got.Me.XP != 150 {
		t.Fatalf("view %s (%v)", data, err)
	}
	if data := a.view(viewer{follow: true}); !json.Valid(data) {
		t.Fatalf("spectator view %s", data)
	}
}

func TestTheWorldMessageIsJSON(t *testing.T) {
	a := newArena(rand.New(rand.NewPCG(5, 6)), 20)
	var got worldMessage
	if err := json.Unmarshal(a.world, &got); err != nil || got.Type != "world" || len(got.Species) != len(speciesList) || len(got.Ponds) == 0 || len(got.Bushes) == 0 {
		t.Fatalf("world %s (%v)", a.world, err)
	}
}
