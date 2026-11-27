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

// inMessage is the arena's "input" (dx, dy: where to steer), "spawn" and "boost"; "game" (data, relayed as it came to
// every other player); or a lobby's "host", "search", "join" (host), "leave" and, from a lobby's host, "start".
type inMessage struct {
	Type string          `json:"type"`
	Host string          `json:"host"`
	DX   float64         `json:"dx"`
	DY   float64         `json:"dy"`
	Data json.RawMessage `json:"data"`
}

// worldMessage is the arena's map and rules, sent once to each connection; the "state" messages that follow refer to it.
type worldMessage struct {
	Type    string     `json:"type"`
	W       float64    `json:"w"`
	H       float64    `json:"h"`
	Tick    int        `json:"tick"`  // state messages a second
	Boost   float64    `json:"boost"` // seconds between boosts
	Species []species  `json:"species"`
	Foods   []foodKind `json:"foods"`
	Ponds   []circle   `json:"ponds"`
	Bushes  []circle   `json:"bushes"`
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
	Alive    bool    `json:"alive"`
	ID       int     `json:"id"`
	Sp       int     `json:"sp"`
	XP       int     `json:"xp"`
	HP       int     `json:"hp"`
	Hunger   int     `json:"hunger"`
	Cooldown float64 `json:"cooldown"` // seconds until it can boost
	Kills    int     `json:"kills"`
}

type meDead struct {
	Alive bool   `json:"alive"`
	By    string `json:"by"` // who ate them; "" when they starved
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
	case "input", "spawn", "boost", "host", "search", "leave", "start":
		return msg, true
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
	data, _ := json.Marshal(worldMessage{Type: "world", W: worldW, H: worldH, Tick: a.rate, Boost: boostCooldown, Species: speciesList, Foods: foodKinds, Ponds: a.ponds, Bushes: a.bushes})
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
		data, _ = json.Marshal(meAlive{Alive: true, ID: c.id, Sp: c.sp, XP: int(c.xp), HP: int(math.Ceil(c.hp)), Hunger: int(math.Ceil(c.hunger)), Cooldown: math.Round(c.cooldown*100) / 100, Kills: c.kills})
	case v.died != nil:
		d := v.died
		data, _ = json.Marshal(meDead{By: html.EscapeString(d.By), BySp: d.BySp, Sp: d.Sp, XP: int(d.XP), Kills: d.Kills, Secs: int(d.Secs)})
	default:
		data = []byte("null")
	}
	return append(b, data...)
}

func encodeGame(from string, payload json.RawMessage) []byte {
	data, _ := json.Marshal(gameMessage{Type: "game", From: html.EscapeString(from), Data: payload})
	return data
}
