package websocket

import (
	"encoding/json"
	"math"
	"math/rand/v2"
	"regexp"
	"testing"
)

// newTestArena keeps the map's coast (the sea is east of x = 4500 or so) but nothing else: no food, bots, bushes,
// kelp or ponds, and nothing grows back.
func newTestArena() *arena {
	a := newArena(rand.New(rand.NewPCG(1, 2)), 20)
	a.creatures, a.food, a.bushes, a.kelp, a.ponds = nil, nil, nil, nil, nil
	a.landFood, a.seaFood, a.minBots, a.totalCreatures = 0, 0, 0, 0
	return a
}

func spOf(t *testing.T, name string) int {
	for i, s := range speciesList {
		if s.Name == name {
			return i
		}
	}
	t.Fatalf("no species %q", name)
	return -1
}

// put adds a player's creature of the named species at x, y, with full hp and no spawn protection.
func put(t *testing.T, a *arena, name, species string, x, y float64) *creature {
	c := a.spawn(name)
	c.sp, c.x, c.y, c.guard = spOf(t, species), x, y, 0
	c.hp = c.maxHP()
	return c
}

func TestTheTreeGrowsOneTierAtATimeAndBothWaysReachTheTop(t *testing.T) {
	reached := map[int]bool{starter: true}
	for changed := true; changed; {
		changed = false
		for i := range speciesList {
			for _, n := range speciesList[i].Next {
				if speciesList[n].Tier != speciesList[i].Tier+1 || speciesList[n].R <= speciesList[i].R {
					t.Fatalf("%s -> %s is not one tier up", speciesList[i].Name, speciesList[n].Name)
				}
				if reached[i] && !reached[n] {
					reached[n], changed = true, true
				}
			}
		}
	}
	for i, s := range speciesList {
		if !reached[i] {
			t.Errorf("nothing evolves into %s", s.Name)
		}
		if s.Tier < len(tierNeed)-1 && len(s.Next) == 0 {
			t.Errorf("%s is a dead end", s.Name)
		}
	}
	if !reached[spOf(t, "Leviathan")] || !reached[spOf(t, "Dragon")] {
		t.Fatal("a top is out of reach")
	}
}

func TestABiggerCreatureEatsASmallerOneItCatches(t *testing.T) {
	a := newTestArena()
	rex := put(t, a, "ann", "T-Rex", 1000, 1000)
	raptor := put(t, a, "bea", "Raptor", 1040, 1000)
	a.step(0.05)
	if raptor.dead == nil || raptor.dead.By != "ann" {
		t.Fatalf("the raptor is alive, or eaten by the wrong one: %+v", raptor.dead)
	}
	if rex.kills != 1 || rex.xp <= 0 {
		t.Fatalf("the rex got nothing: kills %d, xp %v", rex.kills, rex.xp)
	}
}

func TestSpawnProtectionKeepsANewCreatureFromBeingEaten(t *testing.T) {
	a := newTestArena()
	put(t, a, "ann", "T-Rex", 1000, 1000)
	m := a.spawn("bea")
	m.x, m.y = 1010, 1000
	a.step(0.05)
	if m.dead != nil {
		t.Fatal("a protected millipede was eaten")
	}
}

func TestCreaturesOfOneTierPushApartAndOnlyBiteWithABoost(t *testing.T) {
	a := newTestArena()
	p := put(t, a, "ann", "Sabertooth", 1000, 1000)
	q := put(t, a, "bea", "Triceratops", 1040, 1000)
	a.step(0.05)
	if p.dead != nil || q.dead != nil {
		t.Fatal("one ate the other")
	}
	if d := math.Hypot(p.x-q.x, p.y-q.y); d < p.r()+q.r()-0.01 {
		t.Fatalf("still overlapping: %v apart", d)
	}
	if p.hp != p.maxHP() || q.hp != q.maxHP() {
		t.Fatalf("hp %v and %v without a bite", p.hp, q.hp)
	}
	q.x, q.y = 1060, 1000
	p.angle = 0
	a.boost(p)
	a.step(0.05)
	if q.hp >= q.maxHP() || p.hp != p.maxHP() {
		t.Fatalf("after ann's boost: ann %v hp, bea %v hp", p.hp, q.hp)
	}
}

func TestABiteThatEmptiesHPEatsTheVictim(t *testing.T) {
	a := newTestArena()
	p := put(t, a, "ann", "Sabertooth", 1000, 1000)
	q := put(t, a, "bea", "Sabertooth", 1060, 1000)
	q.hp, p.angle = 10, 0
	a.boost(p)
	a.step(0.05)
	if q.dead == nil || q.dead.By != "ann" {
		t.Fatal("a bite that emptied bea's hp did not eat her")
	}
}

func TestCoverHidesSmallCreaturesOnLandAndAtSea(t *testing.T) {
	a := newTestArena()
	a.bushes = []circle{{X: 1000, Y: 1000, R: 80}}
	sea := a.coastX(3000) + 800
	a.kelp = []circle{{X: sea, Y: 3000, R: 90}}
	put(t, a, "ann", "T-Rex", 1010, 1000)
	raptor := put(t, a, "bea", "Raptor", 1000, 1000)
	put(t, a, "cy", "Mosasaur", sea+10, 3000)
	ammonite := put(t, a, "dee", "Ammonite", sea, 3000)
	a.step(0.05)
	if !raptor.hidden || raptor.dead != nil || !ammonite.hidden || ammonite.dead != nil {
		t.Fatalf("raptor hidden %v dead %v; ammonite hidden %v dead %v", raptor.hidden, raptor.dead, ammonite.hidden, ammonite.dead)
	}
	tooth := put(t, a, "eve", "Sabertooth", 1000, 1000)
	a.step(0.05)
	if tooth.hidden {
		t.Fatal("a sabertooth hid in a bush")
	}
}

func TestDevilFrogsHideUnderWater(t *testing.T) {
	a := newTestArena()
	a.ponds = []circle{{X: 1000, Y: 1000, R: 200}}
	frog := put(t, a, "ann", "Devil Frog", 1000, 1000)
	put(t, a, "bea", "Raptor", 1010, 1000)
	a.step(0.05)
	if !frog.hidden || frog.dead != nil {
		t.Fatalf("the frog in the pond: hidden %v, dead %v", frog.hidden, frog.dead)
	}
}

func TestHabitatsSetTheSpeed(t *testing.T) {
	a := newTestArena()
	sea := a.coastX(2000) + 600
	if a.terrain(1000, 2000) != ground || a.terrain(sea, 2000) != ocean {
		t.Fatal("the coast is not where it should be")
	}
	run := func(species string, x float64) float64 {
		c := put(t, a, "ann", species, x, 2000)
		c.dx = 1
		for range 20 {
			a.step(0.05)
		}
		c.dead = &death{left: true}
		a.step(0.05)
		return c.x - x
	}
	if land, wet := run("Raptor", 1000), run("Raptor", sea); wet > land*0.6 {
		t.Fatalf("a raptor went %v at sea and %v on land", wet, land)
	}
	if land, wet := run("Megalodon", 1000), run("Megalodon", sea); land > wet*0.5 {
		t.Fatalf("a megalodon went %v on land and %v at sea", land, wet)
	}
	if land, wet := run("Griffin", 1000), run("Griffin", sea); math.Abs(land-wet) > 1 {
		t.Fatalf("a griffin went %v on land and %v at sea", land, wet)
	}
}

func TestEnoughXPOffersTheSpeciesItLeadsTo(t *testing.T) {
	a := newTestArena()
	c := put(t, a, "ann", "Millipede", 1000, 1000)
	c.progress = tierNeed[0] - 1
	a.food = []*foodItem{{id: a.id(), kind: 2, x: 1005, y: 1000}}
	a.step(0.05)
	if !c.offer || c.sp != starter {
		t.Fatalf("offer %v, species %s after the egg", c.offer, c.kind().Name)
	}
	a.evolve(c, spOf(t, "Raptor")) // not one the millipede leads to
	if !c.offer || c.sp != starter {
		t.Fatal("evolved into a species the millipede does not lead to")
	}
	a.evolve(c, spOf(t, "Compy"))
	if c.offer || c.kind().Name != "Compy" || c.progress >= tierNeed[0] || c.hp != c.maxHP() {
		t.Fatalf("after choosing Compy: offer %v, %s, progress %v, hp %v", c.offer, c.kind().Name, c.progress, c.hp)
	}
}

func TestStayingGivesAStatPointAndOffersAgainSooner(t *testing.T) {
	a := newTestArena()
	c := put(t, a, "ann", "Raptor", 1000, 1000)
	c.progress, c.offer = tierNeed[2], true
	a.evolve(c, -1)
	if c.offer || c.points != 1 || c.sp != spOf(t, "Raptor") || c.progress != tierNeed[2]/2 {
		t.Fatalf("after staying: offer %v, points %d, %s, progress %v", c.offer, c.points, c.kind().Name, c.progress)
	}
	bite := biteDamage(c)
	a.upgrade(c, "bite")
	if c.points != 0 || c.biteLv != 1 || biteDamage(c) <= bite {
		t.Fatalf("after upgrading: points %d, bite %d, damage %v from %v", c.points, c.biteLv, biteDamage(c), bite)
	}
	a.upgrade(c, "ability") // no points left
	if c.abilityLv != 0 {
		t.Fatal("upgraded without a point")
	}
	c.points, c.abilityLv = 3, maxLevel
	a.upgrade(c, "ability")
	if c.abilityLv != maxLevel || c.points != 3 {
		t.Fatal("raised a stat past its top level")
	}
}

func TestTheTopOfTheChainEarnsStatPoints(t *testing.T) {
	a := newTestArena()
	c := put(t, a, "ann", "Dragon", 1000, 1000)
	c.progress = tierNeed[9] + 1
	a.step(0.05)
	if c.offer || c.points != 1 {
		t.Fatalf("offer %v, points %d", c.offer, c.points)
	}
}

func TestAStompHurtsWhatIsNearUpToATierAbove(t *testing.T) {
	a := newTestArena()
	rex := put(t, a, "ann", "T-Rex", 1000, 1000)
	near := put(t, a, "bea", "Mosasaur", 1100, 1000)  // its tier
	big := put(t, a, "cy", "Sea Serpent", 1000, 1100) // a tier up
	huge := put(t, a, "dee", "Kraken", 900, 1000)     // two tiers up
	far := put(t, a, "eve", "Titanoboa", 1600, 1000)  // out of reach
	a.useAbility(rex)
	if near.hp >= near.maxHP() || big.hp >= big.maxHP() {
		t.Fatalf("near %v, a tier up %v: not hurt", near.hp, big.hp)
	}
	if huge.hp != huge.maxHP() || far.hp != far.maxHP() {
		t.Fatalf("hurt two tiers up (%v) or out of reach (%v)", huge.hp, far.hp)
	}
	if near.vx <= 0 {
		t.Fatal("not thrown back")
	}
	if rex.abilityCd == 0 {
		t.Fatal("no cooldown")
	}
	hp := near.hp
	a.useAbility(rex)
	if near.hp != hp {
		t.Fatal("the stomp went off again while cooling down")
	}
}

func TestAPullDragsIn(t *testing.T) {
	a := newTestArena()
	boa := put(t, a, "ann", "Titanoboa", 1000, 1000)
	prey := put(t, a, "bea", "T-Rex", 1150, 1000)
	a.useAbility(boa)
	if prey.vx >= 0 || prey.hp >= prey.maxHP() {
		t.Fatalf("pulled at %v, hp %v", prey.vx, prey.hp)
	}
}

func TestAChargeHurtsTheFirstCreatureItRunsInto(t *testing.T) {
	a := newTestArena()
	tri := put(t, a, "ann", "Triceratops", 1000, 1000)
	tri.angle = 0
	foe := put(t, a, "bea", "Sabertooth", 1120, 1000)
	a.useAbility(tri)
	for range 10 {
		a.step(0.05)
	}
	if foe.hp >= foe.maxHP() || !tri.chargeHit {
		t.Fatalf("foe at %v hp after the charge", foe.hp)
	}
}

func TestASpitFliesAndHitsAndALevelHurtsMore(t *testing.T) {
	a := newTestArena()
	frog := put(t, a, "ann", "Devil Frog", 1000, 1000)
	frog.angle = 0
	foe := put(t, a, "bea", "Compy", 1300, 1000)
	foe.hunger = 20 // too hungry to heal
	weak := abilityDamage(frog)
	a.useAbility(frog)
	if len(a.shots) != 1 {
		t.Fatalf("%d shots", len(a.shots))
	}
	for range 20 {
		a.step(0.05)
	}
	if len(a.shots) != 0 || foe.maxHP()-foe.hp < weak-0.01 {
		t.Fatalf("shots %d, foe hp %v", len(a.shots), foe.hp)
	}
	frog.abilityLv = 2
	if abilityDamage(frog) <= weak {
		t.Fatal("a level did not raise the damage")
	}
}

func TestAnAbilityThatEmptiesHPEatsTheVictim(t *testing.T) {
	a := newTestArena()
	rex := put(t, a, "ann", "T-Rex", 1000, 1000)
	foe := put(t, a, "bea", "Mosasaur", 1100, 1000)
	foe.hp = 1
	a.useAbility(rex)
	if foe.dead == nil || foe.dead.By != "ann" || rex.kills != 1 {
		t.Fatalf("death %+v, kills %d", foe.dead, rex.kills)
	}
}

func TestStarvingCostsHPAndDropsMeat(t *testing.T) {
	a := newTestArena()
	c := put(t, a, "ann", "Sabertooth", 1000, 1000)
	c.hunger, c.hp = 0, 1
	a.step(0.5)
	if c.dead == nil || c.dead.By != "" {
		t.Fatalf("death %+v, want starved", c.dead)
	}
	if len(a.food) != 4 {
		t.Fatalf("%d meat, want 4", len(a.food))
	}
}

func TestBoostsCostHungerAndCoolDown(t *testing.T) {
	a := newTestArena()
	c := put(t, a, "ann", "Millipede", 1000, 1000)
	h := c.hunger
	a.boost(c)
	a.boost(c)
	if c.hunger != h-boostCost || c.dash != boostTime {
		t.Fatalf("hunger %v, dash %v", c.hunger, c.dash)
	}
}

func TestCreaturesStayInTheWorld(t *testing.T) {
	a := newTestArena()
	c := put(t, a, "ann", "Ankylosaurus", 20, 20)
	c.dx, c.dy = -1, -1
	for range 40 {
		a.step(0.05)
	}
	if r := c.r(); c.x < r || c.y < r {
		t.Fatalf("at %v, %v", c.x, c.y)
	}
}

// A full arena runs for a few simulated minutes: bots come and go, keep to where they belong, never grow past their
// cap, and nothing leaves the world or turns NaN.
func TestAFullArenaRuns(t *testing.T) {
	a := newArena(rand.New(rand.NewPCG(3, 4)), 20)
	ann := a.spawn("ann")
	ann.dx = 1
	seaBots, wet := 0, 0
	for i := range 4000 {
		a.step(0.05)
		for _, c := range a.creatures {
			r := c.r()
			if math.IsNaN(c.x) || math.IsNaN(c.y) || c.x < r-0.01 || c.y < r-0.01 || c.x > worldW-r+0.01 || c.y > worldH-r+0.01 {
				t.Fatalf("step %d: %s at %v, %v", i, c.name, c.x, c.y)
			}
			if c.bot != nil && c.tier() > botTopTier {
				t.Fatalf("step %d: a bot %s", i, c.kind().Name)
			}
			if c.bot != nil && c.kind().Habitat == sea && i%100 == 0 {
				seaBots++
				if a.terrain(c.x, c.y) == ocean {
					wet++
				}
			}
		}
	}
	if len(a.creatures) < a.minBots || len(a.food) < (a.landFood+a.seaFood)/2 {
		t.Fatalf("%d creatures and %d food after the run", len(a.creatures), len(a.food))
	}
	if seaBots == 0 || float64(wet) < 0.9*float64(seaBots) {
		t.Fatalf("sea bots were at sea %d times in %d", wet, seaBots)
	}
}

func TestTheViewIsJSONAndOnlyWhatIsNear(t *testing.T) {
	a := newTestArena()
	c := put(t, a, "ann", "Devil Frog", 1000, 1000)
	put(t, a, "bea", "Millipede", 1100, 1000)
	put(t, a, "cy", "Millipede", 3900, 3900)
	a.food = []*foodItem{{id: a.id(), kind: 0, x: 1200, y: 1000}, {id: a.id(), kind: 1, x: 3800, y: 3800}}
	c.angle, c.offer = 0, true
	a.useAbility(c)
	a.step(0.05)
	var got struct {
		Type string
		Me   struct {
			Alive bool
			ID    int
			Offer []int
			MaxHP int
		}
		C  [][]any
		F  [][]int
		P  [][]int
		E  [][]int
		LB []boardEntry
	}
	data := a.view(viewer{cr: c})
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("%v in %s", err, data)
	}
	if got.Type != "state" || !got.Me.Alive || got.Me.ID != c.id || len(got.Me.Offer) != 2 || got.Me.MaxHP != 115 ||
		len(got.C) != 2 || len(got.F) != 1 || len(got.P) != 1 || len(got.LB) != 3 {
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
	if err := json.Unmarshal(a.world, &got); err != nil || got.Type != "world" || len(got.Species) != len(speciesList) ||
		len(got.Ponds) == 0 || len(got.Bushes) == 0 || len(got.Kelp) == 0 || len(got.Coast) < int(worldH/coastStep) {
		t.Fatalf("world %.300s (%v)", a.world, err)
	}
}

func TestGuestsGetNamesNoAccountCanHave(t *testing.T) {
	g := &guestBook{byKey: map[string]string{}, byName: map[string]string{}}
	k1, k2 := "0123456789abcdef0123456789abcdef", "fedcba9876543210fedcba9876543210"
	n1, n2 := g.name(k1), g.name(k2)
	if n1 == n2 || g.name(k1) != n1 {
		t.Fatalf("names %q, %q, %q", n1, n2, g.name(k1))
	}
	username := regexp.MustCompile(`^[a-z0-9_]{3,20}$`) // the auth service's rule
	if username.MatchString(n1) || !regexp.MustCompile(`^Guest\d{4,}$`).MatchString(n1) {
		t.Fatalf("guest name %q", n1)
	}
	g.release(n1)
	g.release("ann") // not a guest: nothing happens
	if _, ok := g.byKey[k1]; ok || len(g.byName) != 1 {
		t.Fatalf("after release: %v", g.byName)
	}
	if !guestKey.MatchString(k1) || guestKey.MatchString("short") || guestKey.MatchString("0123456789ABCDEF0123456789abcdef") {
		t.Fatal("guest keys")
	}
}
