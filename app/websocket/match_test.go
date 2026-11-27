package websocket

import (
	"encoding/json"
	"math"
	"math/rand/v2"
	"os"
	"slices"
	"testing"
)

// The package's tests read the same tables the server embeds (main.go): the game's walk.json and arena.json.
func TestMain(m *testing.M) {
	walk, err1 := os.ReadFile("../game/src/content/walk.json")
	ar, err2 := os.ReadFile("../game/src/content/arena.json")
	if err1 != nil || err2 != nil {
		panic("the game's tables: " + errorText(err1, err2))
	}
	if err := Load(walk, ar); err != nil {
		panic(err)
	}
	os.Exit(m.Run())
}

func errorText(errs ...error) string {
	for _, e := range errs {
		if e != nil {
			return e.Error()
		}
	}
	return ""
}

func testMatch(n int) *match {
	members := []string{"ann", "bea", "cy", "dov"}[:n]
	return newMatch(members, rand.New(rand.NewPCG(1, 2)))
}

func run(m *match, seconds float64) {
	for range int(math.Round(seconds * 20)) {
		m.step(1.0 / 20)
	}
}

func openZones(lay *layout) int {
	n := 0
	for _, o := range lay.open {
		if o {
			n++
		}
	}
	return n
}

func TestTheMineOpensThreeZonesAPlayer(t *testing.T) {
	for n := 1; n <= maxLobbyPlayers; n++ {
		lay := &arena.layouts[n-1]
		if len(lay.seats) != n || openZones(lay) != 3*n {
			t.Fatalf("%d players: %d seats, %d zones open", n, len(lay.seats), openZones(lay))
		}
		if len(lay.spots) < 100 {
			t.Fatalf("%d players: only %d spots for crystals", n, len(lay.spots))
		}
	}
}

// Every open zone of a layout is reached from the first shrine: no seat is walled off from another.
func TestEveryOpenZoneIsReachable(t *testing.T) {
	g := &arena.ground
	for n := 1; n <= maxLobbyPlayers; n++ {
		lay := &arena.layouts[n-1]
		s := lay.seats[0].Shrine
		start := int(s[1]/g.cell)*g.gw + int(s[0]/g.cell)
		seen := map[int]bool{start: true}
		queue := []int{start}
		zones := map[uint8]bool{}
		for len(queue) > 0 {
			c := queue[0]
			queue = queue[1:]
			zones[g.zone[c]] = true
			for _, d := range []int{1, -1, g.gw, -g.gw} {
				if k := c + d; k >= 0 && k < len(g.zone) && !seen[k] && g.zone[k] != rock && lay.open[g.zone[k]] {
					seen[k] = true
					queue = append(queue, k)
				}
			}
		}
		if len(zones) != openZones(lay) {
			t.Fatalf("%d players: %d of %d open zones reached", n, len(zones), openZones(lay))
		}
	}
}

func TestPlayersSpawnAtTheirOwnShrines(t *testing.T) {
	m := testMatch(4)
	for i, p := range m.players {
		if s := m.lay.seats[i].Shrine; p.seat != i || p.x != s[0] || p.y != s[1] {
			t.Fatalf("%s at %v,%v in seat %d, want seat %d at %v", p.name, p.x, p.y, p.seat, i, s)
		}
	}
	if len(m.crystals) != m.capacity() {
		t.Fatalf("%d crystals at the start, want %d", len(m.crystals), m.capacity())
	}
}

func TestWalkingMovesAtTheRulesSpeed(t *testing.T) {
	m := testMatch(2)
	m.crystals = nil
	p := m.players[1]
	x := p.x
	m.input("bea", -1, 0)
	run(m, 1)
	if got := x - p.x; math.Abs(got-arena.rules.Speed) > 0.01 || !p.moving || p.face != -1 {
		t.Fatalf("walked %v in a second facing %v, want %v", got, p.face, arena.rules.Speed)
	}
}

func TestTheWallsHold(t *testing.T) {
	m := testMatch(1)
	p := m.players[0]
	m.input("ann", 0, 1)
	run(m, 30)
	if !m.lay.stands(p.x, p.y) {
		t.Fatalf("walked into rock at %v,%v", p.x, p.y)
	}
	m.input("ann", 1, 1)
	run(m, 30)
	if !m.lay.stands(p.x, p.y) {
		t.Fatalf("walked into rock at %v,%v", p.x, p.y)
	}
}

// The bunks (the four player mine's north-west shrine) are shut to two players, the west drift (two players' west
// shrine) to one: shut ground is rock to the feet.
func TestClosedZonesAreRock(t *testing.T) {
	bunks, drift := arena.layouts[3].seats[0].Shrine, arena.layouts[1].seats[0].Shrine
	if !arena.layouts[3].stands(bunks[0], bunks[1]) || arena.layouts[1].stands(bunks[0], bunks[1]) {
		t.Fatal("the bunks should be open to four players and shut to two")
	}
	if arena.layouts[0].stands(drift[0], drift[1]) {
		t.Fatal("the west drift should be shut to one player")
	}
}

func TestGatheringAndGivingScores(t *testing.T) {
	m := testMatch(2)
	p := m.players[0]
	s := m.lay.seats[0].Shrine
	m.crystals = []crystal{{id: 1, x: p.x + 4, y: p.y}, {id: 2, x: p.x - 4, y: p.y}}
	// standing at the shrine: picked up and given in one step
	m.step(0.05)
	if m.score[0] != 2 || p.carry != 0 {
		t.Fatalf("score %v carry %d, want 2 given", m.score, p.carry)
	}
	// away from it: carried, up to the cap
	p.x, p.y = s[0]+400, s[1]
	for !m.lay.stands(p.x, p.y) {
		p.x -= 8
	}
	for i := range arena.rules.Carry + 2 {
		m.crystals = append(m.crystals, crystal{id: 10 + i, x: p.x, y: p.y})
	}
	m.step(0.05)
	if p.carry != arena.rules.Carry {
		t.Fatalf("carry %d, want the cap %d", p.carry, arena.rules.Carry)
	}
}

func TestTheGoalWinsAndTheMatchEnds(t *testing.T) {
	m := testMatch(2)
	p := m.players[1]
	m.score[1] = arena.rules.Goal - 1
	p.carry = 1
	m.step(0.05)
	if m.winner != 1 {
		t.Fatalf("winner %d, want seat 1", m.winner)
	}
	m.input("bea", 1, 0)
	x := p.x
	run(m, arena.rules.Over-0.5)
	if m.done() || p.x != x {
		t.Fatal("the match ended early, or someone moved once it was won")
	}
	run(m, 1)
	if !m.done() {
		t.Fatal("the match did not end")
	}
}

// face puts q in front of p, `d` away along x, both on open floor of the mine's middle.
func face(m *match, p, q *mPlayer, d float64) {
	p.x, p.y = 1204, 804
	q.x, q.y = p.x+d, p.y
}

func TestABlowStunsAndScattersWhatTheyCarry(t *testing.T) {
	m := testMatch(4)
	m.crystals = nil
	ann, dov := m.players[0], m.players[3] // dov's domain holds the grave
	face(m, ann, dov, 20)
	dov.carry = 3
	m.strike("ann", 1, 0)
	run(m, arena.rules.Blow+0.05)
	if dov.stun <= 0 || dov.carry != 0 || len(m.crystals) != 3 {
		t.Fatalf("stun %v carry %d crystals %d, want stunned with 3 scattered", dov.stun, dov.carry, len(m.crystals))
	}
	if d := math.Hypot(dov.x-ann.x, dov.y-ann.y); d <= 20 {
		t.Fatalf("not knocked back: %v away", d)
	}
	for _, c := range m.crystals {
		if !m.lay.stands(c.x, c.y) && (c.x != dov.x || c.y != dov.y) {
			t.Fatalf("a crystal scattered into rock at %v,%v", c.x, c.y)
		}
	}
}

func TestABlowMissesBehindAndOutOfReach(t *testing.T) {
	m := testMatch(4)
	ann, dov := m.players[0], m.players[3]
	face(m, ann, dov, -20)
	m.strike("ann", 1, 0) // aimed away
	run(m, arena.rules.Swing)
	face(m, ann, dov, arena.rules.Reach+arena.rules.Feet+4)
	m.strike("ann", 1, 0)
	run(m, arena.rules.Swing)
	if dov.stun > 0 {
		t.Fatal("struck from behind or out of reach")
	}
}

func TestNoBlowLandsAtTheirOwnShrine(t *testing.T) {
	m := testMatch(2)
	ann, bea := m.players[0], m.players[1]
	ann.x, ann.y = bea.x-20, bea.y // bea stands on her shrine
	m.strike("ann", 1, 0)
	run(m, arena.rules.Swing)
	if bea.stun > 0 {
		t.Fatal("struck at her own shrine")
	}
}

func TestLeavingDropsWhatTheyCarry(t *testing.T) {
	l, got := newTestLobbies()
	say(l, "ann", "host", "")
	say(l, "bea", "join", "ann")
	say(l, "ann", "start", "")
	m := l.byHost["ann"].match
	m.crystals = nil
	m.player("bea").carry = 2
	say(l, "bea", "leave", "")
	if len(m.players) != 1 || len(m.crystals) != 2 {
		t.Fatalf("%d players, %d crystals: want bea gone and her 2 dropped", len(m.players), len(m.crystals))
	}
	if !slices.Contains(got["bea"], `{"type":"match","match":null}`) {
		t.Fatal("bea was not told she is out of the match")
	}
}

func TestAPlayingLobbyIsNotListedOrJoined(t *testing.T) {
	l, got := newTestLobbies()
	say(l, "ann", "host", "")
	say(l, "ann", "start", "")
	say(l, "cy", "join", "ann")
	if want := `{"type":"lobbies","lobbies":[],"refused":"playing"}`; got.last("cy") != want {
		t.Fatalf("got %s, want %s", got.last("cy"), want)
	}
}

func TestStepSendsTheWorldAndEndsAWonMatch(t *testing.T) {
	l, got := newTestLobbies()
	say(l, "ann", "host", "")
	say(l, "ann", "start", "")
	l.step(0.05)
	var w worldMessage
	if err := json.Unmarshal([]byte(got.last("ann")), &w); err != nil || w.Type != "world" || len(w.Players) != 1 || w.Winner != -1 {
		t.Fatalf("got %s", got.last("ann"))
	}
	m := l.byHost["ann"].match
	m.winner, m.over = 0, arena.rules.Over
	l.step(0.05)
	if l.byHost["ann"].match != nil || got.last("ann") != `{"type":"match","match":null}` {
		t.Fatalf("the won match did not end: %s", got.last("ann"))
	}
	say(l, "ann", "start", "") // and the lobby can play again
	if l.byHost["ann"].match == nil {
		t.Fatal("no second match")
	}
}

func TestInputAndStrikeOutsideAMatchDoNothing(t *testing.T) {
	l, got := newTestLobbies()
	say(l, "ann", "host", "")
	l.handle("ann", inMessage{Type: "input", DX: 1})
	l.handle("ann", inMessage{Type: "strike", DX: 1})
	l.handle("bob", inMessage{Type: "strike", DX: 1})
	if len(got["bob"]) != 0 || len(got["ann"]) != 1 {
		t.Fatalf("got %v", got)
	}
}
