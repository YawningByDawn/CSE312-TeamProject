package websocket

import (
	"encoding/json"
	"maps"
	"math"
	"math/rand/v2"
	"regexp"
	"slices"
	"testing"
)

// newTestArena keeps the map's coast (the sea is east of x = 7300 or so) and biome borders but nothing else: no food,
// bots, bushes, kelp, ponds, islands, tar, lava, ice, crags or food sources, and nothing grows back.
func newTestArena() *arena {
	a := newArena(rand.New(rand.NewPCG(1, 2)), 20)
	a.creatures, a.food, a.bushes, a.kelp, a.ponds = nil, nil, nil, nil, nil
	a.islands, a.tar, a.rocks, a.reefs, a.sources, a.lava, a.ice = nil, nil, nil, nil, nil, nil, nil
	a.foodTarget, a.minBots, a.totalCreatures = map[string]int{}, 0, 0
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

func TestABiggerCreatureBitesASmallerOneThatBitesBackAndRuns(t *testing.T) {
	a := newTestArena()
	rex := put(t, a, "ann", "T-Rex", 1000, 1000)
	rex.angle = 0 // facing the raptor, not showing it its tail
	raptor := put(t, a, "bea", "Raptor", 1060, 1000)
	a.step(0.05)
	if raptor.dead != nil || raptor.hp >= raptor.maxHP() {
		t.Fatalf("after one bite the raptor is dead (%v) or unhurt (%v hp)", raptor.dead, raptor.hp)
	}
	if raptor.flee == 0 || raptor.vx <= 0 {
		t.Fatalf("the raptor was not thrown clear to run: flee %v, vx %v", raptor.flee, raptor.vx)
	}
	if rex.hp >= rex.maxHP() {
		t.Fatal("the raptor did not bite back")
	}
	hp := raptor.hp
	raptor.x, raptor.y = 1060, 1000
	a.step(0.05)
	if raptor.hp != hp {
		t.Fatal("bit again before the bite cooled down")
	}
	for i := 0; i < 100 && raptor.dead == nil; i++ { // held against the rex, it is eaten in the end
		raptor.x, raptor.y, raptor.vx, raptor.vy, rex.angle = rex.x+60, rex.y, 0, 0, 0
		a.step(0.05)
	}
	if raptor.dead == nil || raptor.dead.By != "ann" || rex.kills != 1 || rex.xp <= 0 {
		t.Fatalf("death %+v, kills %d, xp %v", raptor.dead, rex.kills, rex.xp)
	}
}

func TestNoHitTakesMoreThanHalfAHealth(t *testing.T) {
	a := newTestArena()
	dragon := put(t, a, "ann", "Dragon", 1000, 1000)
	dragon.biteLv = maxLevel
	m := put(t, a, "bea", "Millipede", 1050, 1000)
	a.step(0.05)
	if m.dead != nil || m.hp < m.maxHP()*(1-maxHitShare)-0.01 {
		t.Fatalf("one bite from a dragon left the millipede at %v of %v (dead %v)", m.hp, m.maxHP(), m.dead)
	}
}

func TestASmallerCreatureFightsBackWithABoost(t *testing.T) {
	a := newTestArena()
	compy := put(t, a, "ann", "Compy", 1000, 1000)
	compy.angle = 0
	tooth := put(t, a, "bea", "Sabertooth", 1045, 1000)
	tooth.biteCd, tooth.angle = 10, math.Pi // so only the compy bites, and at its face, not its tail
	a.boost(compy)
	a.step(0.05)
	want := biteDamage(compy) * fightBack(tooth.tier()-compy.tier())
	if got := tooth.maxHP() - tooth.hp; math.Abs(got-want) > 0.01 || want >= biteDamage(compy) {
		t.Fatalf("the compy's bite took %v, want %v (its bite is %v)", got, want, biteDamage(compy))
	}
	tooth.hp = 1
	compy.bit, compy.dash = false, boostTime
	compy.x, compy.y = 1000, 1000
	tooth.x, tooth.y, tooth.vx, tooth.angle = 1045, 1000, 0, math.Pi
	a.step(0.05)
	if tooth.dead == nil || tooth.dead.By != "ann" {
		t.Fatal("a fight-back bite that emptied the sabertooth's hp did not eat it")
	}
}

func TestHealthGrowsBackOnlyAWhileAfterAHurt(t *testing.T) {
	a := newTestArena()
	c := put(t, a, "ann", "Raptor", 1000, 1000)
	a.hurt(c, c, 50, 0)
	hp := c.hp
	a.step(1)
	if c.hp != hp {
		t.Fatalf("healed %v a second after a hurt", c.hp-hp)
	}
	for range 3 {
		a.step(1)
	}
	if c.hp <= hp {
		t.Fatal("never healed")
	}
}

func TestSpeciesStatsTradeHealthForBite(t *testing.T) {
	anky, raptor := speciesList[spOf(t, "Ankylosaurus")], speciesList[spOf(t, "Terror Bird")]
	if anky.Tier != raptor.Tier || anky.HP <= raptor.HP || anky.ATK >= raptor.ATK {
		t.Fatalf("ankylosaurus %v hp %v atk, terror bird %v hp %v atk", anky.HP, anky.ATK, raptor.HP, raptor.ATK)
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
	c := put(t, a, "ann", "Quetzalcoatl", 1000, 1000)
	c.progress = tierNeed[11] + 1
	a.step(0.05)
	if c.offer || c.points != 1 {
		t.Fatalf("offer %v, points %d", c.offer, c.points)
	}
}

func TestAStompHurtsWhatIsNearAndBiggerOnesLess(t *testing.T) {
	a := newTestArena()
	rex := put(t, a, "ann", "T-Rex", 1000, 1000)
	near := put(t, a, "bea", "Mosasaur", 1100, 1000)  // its tier
	big := put(t, a, "cy", "Sea Serpent", 1000, 1100) // a tier up
	huge := put(t, a, "dee", "Kraken", 900, 1000)     // two tiers up
	far := put(t, a, "eve", "Titanoboa", 1600, 1000)  // out of reach
	a.useAbility(rex)
	dmg := abilityDamage(rex)
	if hit := near.maxHP() - near.hp; math.Abs(hit-dmg) > 0.01 {
		t.Fatalf("its own tier took %v, want %v", hit, dmg)
	}
	if hit := big.maxHP() - big.hp; math.Abs(hit-dmg) > 0.01 {
		t.Fatalf("a tier up took %v, want %v", hit, dmg)
	}
	if hit := huge.maxHP() - huge.hp; math.Abs(hit-dmg*fightBack(2)) > 0.01 {
		t.Fatalf("two tiers up took %v, want %v", hit, dmg*fightBack(2))
	}
	if far.hp != far.maxHP() {
		t.Fatalf("hurt out of reach (%v)", far.hp)
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
	if foe.hp >= foe.maxHP() || len(tri.chargeHits) == 0 {
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
	if len(a.creatures) < a.minBots || len(a.food) < 1000 {
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
	if got.Type != "state" || !got.Me.Alive || got.Me.ID != c.id || len(got.Me.Offer) != len(c.kind().Next) || got.Me.MaxHP != int(c.maxHP()) ||
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
		len(got.Ponds) == 0 || len(got.Bushes) == 0 || len(got.Kelp) == 0 || len(got.Coast) < int(worldH)/int(coastStep) {
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

func TestCragsKeepBigCreaturesOffAndLetSmallOnesAndFliersOn(t *testing.T) {
	a := newTestArena()
	a.rocks = []circle{{X: 1000, Y: 1000, R: 100}, {X: 1000, Y: 1500, R: 100}, {X: 1000, Y: 2000, R: 100}}
	big := put(t, a, "ann", "Sabertooth", 850, 1000)
	small := put(t, a, "bea", "Raptor", 850, 1500)
	flier := put(t, a, "cy", "Griffin", 850, 2000)
	for _, c := range []*creature{big, small, flier} {
		c.dx = 1
	}
	for range 10 {
		a.step(0.05)
	}
	if d := math.Hypot(big.x-1000, big.y-1000); d < 100-0.01 {
		t.Fatalf("the sabertooth got %v from the rock's middle", d)
	}
	if small.x < 920 || flier.x < 920 {
		t.Fatalf("the raptor (at %v) or the griffin (at %v) did not get onto its rock", small.x, flier.x)
	}
	// on the rock, the raptor is out of the sabertooth's reach
	small.x, small.y, small.dx = 1000, 1000, 0
	big.x, big.y, big.dx = 880, 1000, 1
	for range 20 {
		a.step(0.05)
	}
	if small.hp != small.maxHP() {
		t.Fatalf("the sabertooth reached the raptor on the rock: %v hp", small.hp)
	}
}

func TestTarBogsDownBigCreaturesMoreThanSmallOnes(t *testing.T) {
	a := newTestArena()
	a.tar = []circle{{X: 1500, Y: 1500, R: 400}}
	run := func(species string) float64 {
		c := put(t, a, "ann", species, 1300, 1500)
		c.dx = 1
		for range 10 {
			a.step(0.05)
		}
		c.dead = &death{left: true}
		a.step(0.05)
		return (c.x - 1300) / speciesList[c.sp].Speed
	}
	if small, big := run("Raptor"), run("Mammoth"); big > small*0.5 {
		t.Fatalf("in tar a mammoth kept %v of its pace, a raptor %v", big, small)
	}
}

func TestIslandsAreLandOutAtSea(t *testing.T) {
	a := newTestArena()
	x := a.coastX(3000) + 1200
	if a.terrain(x, 3000) != ocean {
		t.Fatal("not at sea")
	}
	a.islands = []circle{{X: x, Y: 3000, R: 300}}
	if a.terrain(x, 3000) != ground || a.fits(sea, x, 3000) || !a.fits(land, x, 3000) {
		t.Fatal("the island is not land")
	}
}

func TestSourcesGrowTheirFoodUpToTheirMost(t *testing.T) {
	a := newTestArena()
	a.sources = []*source{{Kind: "tree", X: 1000, Y: 1000, R: 50}}
	for range 400 {
		a.step(0.05)
	}
	nuts := 0
	for _, f := range a.food {
		if foodKinds[f.kind].Name == "ginkgo" && math.Hypot(f.x-1000, f.y-1000) <= 50*1.4+0.01 {
			nuts++
		}
	}
	if k := sourceKinds["tree"]; nuts != k.max || a.sources[0].count != k.max {
		t.Fatalf("%d nuts (counted %d), want %d", nuts, a.sources[0].count, k.max)
	}
	f := a.food[0]
	c := put(t, a, "ann", "Millipede", f.x, f.y)
	a.step(0.05)
	ate := int(math.Round(c.xp / foodKinds[foodIndex("ginkgo")].XP))
	if ate == 0 || a.sources[0].count != sourceKinds["tree"].max-ate {
		t.Fatalf("after one was eaten: xp %v, count %d", c.xp, a.sources[0].count)
	}
}

func TestStarfruitFeedsBigCreaturesAsMuchAsSmall(t *testing.T) {
	a := newTestArena()
	star := foodIndex("starfruit")
	rex := put(t, a, "ann", "T-Rex", 1000, 1000)
	a.food = []*foodItem{{id: a.id(), kind: star, x: 1000, y: 1000}, {id: a.id(), kind: foodIndex("berry"), x: 3000, y: 3000}}
	a.step(0.05)
	if rex.xp != foodKinds[star].XP {
		t.Fatalf("the rex got %v xp from a starfruit, want %v", rex.xp, foodKinds[star].XP)
	}
}

func TestStatPointsRaiseHealthAndSpeedToo(t *testing.T) {
	a := newTestArena()
	c := put(t, a, "ann", "Raptor", 1000, 1000)
	c.points = 3
	top, hp := c.maxHP(), c.hp
	a.upgrade(c, "health")
	if c.hpLv != 1 || c.maxHP() <= top || c.hp-hp != c.maxHP()-top {
		t.Fatalf("health level %d: max %v from %v, hp %v from %v", c.hpLv, c.maxHP(), top, c.hp, hp)
	}
	a.upgrade(c, "speed")
	a.upgrade(c, "nonsense")
	if c.speedLv != 1 || c.points != 1 {
		t.Fatalf("speed level %d, %d points left", c.speedLv, c.points)
	}
	slow := put(t, a, "bea", "Raptor", 1000, 2000)
	c.dx, slow.dx = 1, 1
	for range 20 {
		a.step(0.05)
	}
	if c.x-1000 <= slow.x-1000 {
		t.Fatalf("a speed level went %v, none %v", c.x-1000, slow.x-1000)
	}
}

func TestEveryFoodAndSourceKindIsKnown(t *testing.T) {
	for name, k := range sourceKinds {
		if foodIndex(k.food) < 0 {
			t.Errorf("source %s grows unknown food %q", name, k.food)
		}
	}
	if foodKinds[meat].Name != "meat" {
		t.Error("meat is not at its index")
	}
}

func TestASmallerCreatureBitesATailAndCannotBeBittenThere(t *testing.T) {
	a := newTestArena()
	tooth := put(t, a, "ann", "Sabertooth", 1000, 4000)
	tooth.angle = 0 // facing east: its tail is to the west
	x, y, _ := tailSpot(tooth)
	raptor := put(t, a, "bea", "Raptor", x-10, y)
	raptor.angle = 0
	a.step(0.05)
	if tooth.hp >= tooth.maxHP() || tooth.tailBit == 0 {
		t.Fatalf("the tail bite took nothing: %v hp", tooth.hp)
	}
	if raptor.hp != raptor.maxHP() {
		t.Fatalf("the sabertooth bit back from its tail: raptor at %v", raptor.hp)
	}
	want := biteDamage(raptor) * tailBonus * fightBack(tooth.tier()-raptor.tier())
	if got := tooth.maxHP() - tooth.hp; math.Abs(got-want) > 0.01 {
		t.Fatalf("the tail bite took %v, want %v", got, want)
	}
	// in front, the sabertooth bites
	front := put(t, a, "cy", "Raptor", 1000+tooth.r()+10, 4000)
	tooth.biteCd = 0
	a.step(0.05)
	if front.hp >= front.maxHP() {
		t.Fatal("the sabertooth did not bite the raptor in front of it")
	}
}

func TestLavaBurnsAllButTheFireproofAndFliers(t *testing.T) {
	a := newTestArena()
	a.lava = []circle{{X: 3000, Y: 1000, R: 400}}
	rex := put(t, a, "ann", "T-Rex", 3000, 1000)
	sal := put(t, a, "bea", "Salamander", 3100, 1100)
	bird := put(t, a, "cy", "Argentavis", 2900, 900)
	a.step(0.5)
	if rex.hp >= rex.maxHP() || sal.hp != sal.maxHP() || bird.hp != bird.maxHP() {
		t.Fatalf("rex %v, salamander %v, argentavis %v", rex.hp, sal.hp, bird.hp)
	}
	rex.hp = 1
	a.step(0.5)
	if rex.dead == nil || rex.dead.Cause != "lava" {
		t.Fatalf("death %+v, want lava", rex.dead)
	}
}

func TestIceSlidesAllButTundraCreatures(t *testing.T) {
	a := newTestArena()
	a.ice = []circle{{X: 3000, Y: 7000, R: 600}}
	raptor := put(t, a, "ann", "Raptor", 3000, 7000)
	rhino := put(t, a, "bea", "Woolly Rhino", 3000, 7300)
	for _, c := range []*creature{raptor, rhino} {
		c.vx = 300
	}
	a.step(0.05)
	if raptor.vx < 250 || rhino.vx > 250 {
		t.Fatalf("after letting go: raptor %v, rhino %v", raptor.vx, rhino.vx)
	}
}

func TestTheBiomesLieWhereTheyShould(t *testing.T) {
	a := newTestArena()
	for _, c := range []struct {
		x, y float64
		want string
	}{{4000, 400, volcano}, {4000, 7600, tundra}, {600, 4000, swamp}, {4500, 4000, meadow}, {9700, 4000, oceanBiome}} {
		if got := a.biomeAt(c.x, c.y); got != c.want {
			t.Errorf("%v, %v is %s, want %s", c.x, c.y, got, c.want)
		}
	}
}

func TestEachBiomeGrowsItsOwnFood(t *testing.T) {
	a := newTestArena()
	a.foodTarget = maps.Clone(foodTarget)
	a.restockFood(math.MaxInt)
	for _, f := range a.food {
		if a.biomeAt(f.x, f.y) != f.biome {
			t.Fatalf("%s food at %v, %v, in %s", f.biome, f.x, f.y, a.biomeAt(f.x, f.y))
		}
		if !slices.ContainsFunc(looseFood[f.biome], func(k struct {
			name  string
			share float64
		}) bool {
			return k.name == foodKinds[f.kind].Name
		}) {
			t.Fatalf("%s grew in %s", foodKinds[f.kind].Name, f.biome)
		}
	}
	if len(a.food) < 1500 {
		t.Fatalf("only %d food", len(a.food))
	}
}

func TestBotsAreBornAtHome(t *testing.T) {
	a := newArena(rand.New(rand.NewPCG(8, 8)), 20)
	home := 0
	for _, c := range a.creatures {
		if a.biomeAt(c.x, c.y) == c.kind().Home {
			home++
		}
	}
	if home < len(a.creatures)*9/10 {
		t.Fatalf("%d of %d bots were born at home", home, len(a.creatures))
	}
}

func TestSkillsGrowWithTheirLevel(t *testing.T) {
	a := newTestArena()
	frog := put(t, a, "ann", "Devil Frog", 1000, 4000)
	for _, c := range []struct{ lv, shots int }{{0, 1}, {3, 3}, {5, 5}} {
		a.shots, frog.abilityCd, frog.abilityLv = nil, 0, c.lv
		a.useAbility(frog)
		if len(a.shots) != c.shots {
			t.Fatalf("level %d fired %d shots, want %d", c.lv, len(a.shots), c.shots)
		}
	}
	rex := put(t, a, "bea", "T-Rex", 3000, 4000)
	near := reach(rex)
	rex.abilityLv = 3
	if reach(rex) <= near {
		t.Fatal("a stomp's reach did not grow")
	}
	foe := put(t, a, "cy", "Mosasaur", 3100, 4000)
	a.useAbility(rex)
	if foe.dazed == 0 {
		t.Fatal("a level 3 stomp did not daze")
	}
	// a level 2 charge goes through two creatures, by its side as it passes
	tri := put(t, a, "dee", "Triceratops", 1000, 5000)
	tri.angle, tri.abilityLv = 0, 2
	put(t, a, "eve", "Raptor", 1100, 5045)
	put(t, a, "fay", "Raptor", 1250, 4955)
	a.useAbility(tri)
	for range 10 {
		a.step(0.05)
	}
	if len(tri.chargeHits) != 2 {
		t.Fatalf("the charge hit %d creatures, want 2", len(tri.chargeHits))
	}
}

func TestEverySpeciesHasAHomeAndTheTopIsTier12(t *testing.T) {
	top := 0
	for _, s := range speciesList {
		if _, ok := biomeShare[s.Home]; !ok {
			t.Errorf("%s lives in %q", s.Name, s.Home)
		}
		top = max(top, s.Tier)
	}
	if top != len(tierNeed)-1 || top != 11 {
		t.Fatalf("the top tier is %d", top)
	}
}
