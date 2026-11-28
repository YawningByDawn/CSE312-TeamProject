package websocket

import (
	"cmp"
	"encoding/json"
	"html"
	"math"
	"slices"
)

// All message encoding lives here, so a binary format can replace JSON in one place.

var kickedMessage = []byte(`{"type":"kicked"}`)

// startMessage tells the members of a lobby that its host started it.
var startMessage = []byte(`{"type":"start"}`)

// inMessage is the arena's "input" (dx, dy: where to steer), "spawn", "boost", "ability", "evolve" (to: a species, or
// -1 to stay for a stat point) and "upgrade" (stat: "bite", "ability", "health" or "speed"); "game" (data, relayed as it came to every
// other player); or a lobby's "host", "search", "join" (host), "leave" and, from a lobby's host, "start".
type inMessage struct {
	Type string          `json:"type"`
	Host string          `json:"host"`
	DX   float64         `json:"dx"`
	DY   float64         `json:"dy"`
	To   *int            `json:"to"`
	Stat string          `json:"stat"`
	Data json.RawMessage `json:"data"`
}

// worldMessage is the arena's map and rules, sent once to each connection; the "state" messages that follow refer to it.
type worldMessage struct {
	Type      string     `json:"type"`
	W         float64    `json:"w"`
	H         float64    `json:"h"`
	Tick      int        `json:"tick"`  // state messages a second
	Boost     float64    `json:"boost"` // seconds between boosts
	Coast     []float64  `json:"coast"` // the sea starts coast[i] px from the west, at y = i*coastStep
	CoastStep float64    `json:"coastStep"`
	Needs     []float64  `json:"needs"`    // xp to gain at each tier before evolving
	MaxLevel  int        `json:"maxLevel"` // the most a stat can be raised
	Species   []species  `json:"species"`
	Foods     []foodKind `json:"foods"`
	Ponds     []circle   `json:"ponds"`
	Bushes    []circle   `json:"bushes"`
	Kelp      []circle   `json:"kelp"`
	Islands   []circle   `json:"islands"`
	Tar       []circle   `json:"tar"`
	Rocks     []circle   `json:"rocks"`
	Reefs     []circle   `json:"reefs"`
	Sources   []*source  `json:"sources"`
	Lava      []circle   `json:"lava"`
	Ice       []circle   `json:"ice"`
	Edges     edges      `json:"edges"`     // the biome borders
	ClimbTier int        `json:"climbTier"` // the biggest tier that gets onto rocks and reefs; fliers do too
}

// boardEntry is one row of the leaderboard.
type boardEntry struct {
	Name string `json:"name"`
	XP   int    `json:"xp"`
	Sp   int    `json:"sp"`
	Bot  bool   `json:"bot,omitempty"`
}

// meAlive and meDead are a player's own numbers in their state messages; null before their first spawn.
type meAlive struct {
	Alive     bool    `json:"alive"`
	ID        int     `json:"id"`
	Sp        int     `json:"sp"`
	XP        int     `json:"xp"`
	Progress  int     `json:"progress"` // xp toward the next evolution
	HP        int     `json:"hp"`
	MaxHP     int     `json:"maxHp"`
	Hunger    int     `json:"hunger"`
	Cooldown  float64 `json:"cooldown"`  // seconds until it can boost
	AbilityCd float64 `json:"abilityCd"` // seconds until its ability is ready
	Kills     int     `json:"kills"`
	Offer     []int   `json:"offer"` // the species it may evolve into now; null when it may not
	Points    int     `json:"points"`
	Bite      int     `json:"bite"`    // its bite's level
	Ability   int     `json:"ability"` // its ability's level
	Health    int     `json:"health"`  // its health's level
	Speed     int     `json:"speed"`   // its speed's level
}

type meDead struct {
	Alive bool   `json:"alive"`
	By    string `json:"by"`    // who ate them; "" when they starved or burned
	Cause string `json:"cause"` // "eaten", "starved" or "lava"
	BySp  int    `json:"bySp"`
	Sp    int    `json:"sp"`
	XP    int    `json:"xp"`
	Kills int    `json:"kills"`
	Secs  int    `json:"secs"`
}

type gameMessage struct {
	Type string          `json:"type"`
	From string          `json:"from"`
	Data json.RawMessage `json:"data"`
}

type lobbyView struct {
	Host    string   `json:"host"`
	Name    string   `json:"name"`
	Members []string `json:"members"`
	Max     int      `json:"max"`
}

// lobbyMessage is the lobby its player is in, null for none.
type lobbyMessage struct {
	Type  string     `json:"type"`
	Lobby *lobbyView `json:"lobby"`
}

// lobbiesMessage lists the open lobbies; Refused says why a join did not happen ("full" or "gone").
type lobbiesMessage struct {
	Type    string      `json:"type"`
	Lobbies []lobbyView `json:"lobbies"`
	Refused string      `json:"refused,omitempty"`
}

func decode(data []byte) (inMessage, bool) {
	var msg inMessage
	if json.Unmarshal(data, &msg) != nil {
		return msg, false
	}
	switch msg.Type {
	case "input", "spawn", "boost", "ability", "host", "search", "leave", "start":
		return msg, true
	case "evolve":
		return msg, msg.To != nil
	case "upgrade":
		return msg, slices.Contains(stats, msg.Stat)
	case "game":
		return msg, msg.Data != nil
	case "join":
		return msg, msg.Host != ""
	}
	return msg, false
}

func view(lb *lobby) lobbyView {
	v := lobbyView{Host: html.EscapeString(lb.host), Name: html.EscapeString(lb.host) + "'s lobby", Members: []string{}, Max: maxLobbyPlayers}
	for _, m := range lb.members {
		v.Members = append(v.Members, html.EscapeString(m))
	}
	return v
}

func encodeLobby(lb *lobby) []byte {
	msg := lobbyMessage{Type: "lobby"}
	if lb != nil {
		v := view(lb)
		msg.Lobby = &v
	}
	data, _ := json.Marshal(msg)
	return data
}

func encodeLobbies(list []*lobby, refused string) []byte {
	views := []lobbyView{}
	for _, lb := range list {
		views = append(views, view(lb))
	}
	data, _ := json.Marshal(lobbiesMessage{Type: "lobbies", Lobbies: views, Refused: refused})
	return data
}

func encodeWorld(a *arena) []byte {
	data, _ := json.Marshal(worldMessage{
		Type: "world", W: worldW, H: worldH, Tick: a.rate, Boost: boostCooldown, Coast: a.coast, CoastStep: coastStep,
		Needs: tierNeed, MaxLevel: maxLevel, Species: speciesList, Foods: foodKinds, Ponds: a.ponds, Bushes: a.bushes, Kelp: a.kelp,
		Islands: a.islands, Tar: a.tar, Rocks: a.rocks, Reefs: a.reefs, Sources: a.sources, ClimbTier: climbTier,
		Lava: a.lava, Ice: a.ice, Edges: a.edges,
	})
	return data
}

// encodeBoard ranks the ten creatures with the most xp.
func encodeBoard(cs []*creature) []byte {
	alive := slices.DeleteFunc(slices.Clone(cs), func(c *creature) bool { return c.dead != nil })
	slices.SortFunc(alive, func(p, q *creature) int { return cmp.Compare(q.xp, p.xp) })
	rows := []boardEntry{}
	for _, c := range alive[:min(10, len(alive))] {
		rows = append(rows, boardEntry{Name: html.EscapeString(c.name), XP: int(c.xp), Sp: c.sp, Bot: c.bot != nil})
	}
	data, _ := json.Marshal(rows)
	return data
}

// encodeMe appends a viewer's own numbers to a state message.
func encodeMe(b []byte, v viewer) []byte {
	var data []byte
	switch {
	case v.cr != nil:
		c := v.cr
		me := meAlive{
			Alive: true, ID: c.id, Sp: c.sp, XP: int(c.xp), Progress: int(c.progress), HP: int(math.Ceil(max(0, c.hp))), MaxHP: int(math.Round(c.maxHP())),
			Hunger: int(math.Ceil(c.hunger)), Cooldown: math.Round(c.cooldown*100) / 100, AbilityCd: math.Round(c.abilityCd*100) / 100,
			Kills: c.kills, Points: c.points, Bite: c.biteLv, Ability: c.abilityLv, Health: c.hpLv, Speed: c.speedLv,
		}
		if c.offer {
			me.Offer = c.kind().Next
		}
		data, _ = json.Marshal(me)
	case v.died != nil:
		d := v.died
		data, _ = json.Marshal(meDead{By: html.EscapeString(d.By), Cause: d.Cause, BySp: d.BySp, Sp: d.Sp, XP: int(d.XP), Kills: d.Kills, Secs: int(d.Secs)})
	default:
		data = []byte("null")
	}
	return append(b, data...)
}

// encodeHello tells a new connection the name it plays under: a guest's is made up for it.
func encodeHello(name string) []byte {
	data, _ := json.Marshal(struct {
		Type string `json:"type"`
		Name string `json:"name"`
	}{"hello", html.EscapeString(name)})
	return data
}

func encodeGame(from string, payload json.RawMessage) []byte {
	data, _ := json.Marshal(gameMessage{Type: "game", From: html.EscapeString(from), Data: payload})
	return data
}
