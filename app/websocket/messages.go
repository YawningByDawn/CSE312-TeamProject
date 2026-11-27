package websocket

import (
	"encoding/json"
	"html"
	"math"
)

// All message encoding lives here, so a binary format can replace JSON in one place.

var kickedMessage = []byte(`{"type":"kicked"}`)

// inMessage is "game" (data, relayed as it came to every other player), a lobby's "host", "search", "join" (host),
// "leave" and, from a lobby's host, "start"; in a match "input" (dx, dy: the heading held) and "strike" (dx, dy: the aim).
type inMessage struct {
	Type string          `json:"type"`
	Host string          `json:"host"`
	DX   float64         `json:"dx"`
	DY   float64         `json:"dy"`
	Data json.RawMessage `json:"data"`
}

type playerState struct {
	Name string `json:"name"`
}

type stateMessage struct {
	Type    string        `json:"type"`
	Players []playerState `json:"players"`
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

// lobbiesMessage lists the open lobbies; Refused says why a join did not happen ("full", "gone" or "playing").
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
	case "input", "strike", "host", "search", "leave", "start":
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

// seatView is a seat of the match's mine: its god's shrine and the zones of its domain.
type seatView struct {
	Shrine [2]float64 `json:"shrine"`
	Zones  []string   `json:"zones"`
}

type matchPlayerView struct {
	Name string `json:"name"`
	Seat int    `json:"seat"`
}

// matchView is what a match is, sent as it starts: who sits where, the mine's seats, the goal, and the ticks a second.
type matchView struct {
	Players []matchPlayerView `json:"players"`
	Seats   []seatView        `json:"seats"`
	Goal    int               `json:"goal"`
	Rate    int               `json:"rate"`
}

// matchMessage is the match its player is in, null when they are out of it (it ended, or they left).
type matchMessage struct {
	Type  string     `json:"type"`
	Match *matchView `json:"match"`
}

type worldPlayer struct {
	Name   string  `json:"name"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	DX     float64 `json:"dx"`
	DY     float64 `json:"dy"`
	Face   float64 `json:"face"`
	Walked float64 `json:"walked"`
	Moving bool    `json:"moving"`
	Carry  int     `json:"carry"`
	Swing  float64 `json:"swing"`
	AX     float64 `json:"ax"`
	AY     float64 `json:"ay"`
	Stun   float64 `json:"stun"`
}

// worldMessage is the match as it stands this tick: every player, every crystal on the ground ([id, x, y]), each seat's
// score, and the winning seat (-1 while it plays).
type worldMessage struct {
	Type     string        `json:"type"`
	Seq      int           `json:"seq"`
	Players  []worldPlayer `json:"players"`
	Crystals [][3]float64  `json:"crystals"`
	Score    []int         `json:"score"`
	Winner   int           `json:"winner"`
}

func encodeMatch(m *match, rate int) []byte {
	msg := matchMessage{Type: "match"}
	if m != nil {
		v := matchView{Players: []matchPlayerView{}, Seats: []seatView{}, Goal: arena.rules.Goal, Rate: rate}
		for _, p := range m.players {
			v.Players = append(v.Players, matchPlayerView{Name: html.EscapeString(p.name), Seat: p.seat})
		}
		for _, s := range m.lay.seats {
			v.Seats = append(v.Seats, seatView{Shrine: s.Shrine, Zones: s.Zones})
		}
		msg.Match = &v
	}
	data, _ := json.Marshal(msg)
	return data
}

// r rounds to `places` decimals: the positions need no more, and the message stays small.
func r(v float64, places int) float64 {
	k := math.Pow(10, float64(places))
	return math.Round(v*k) / k
}

func encodeWorld(m *match) []byte {
	msg := worldMessage{Type: "world", Seq: m.seq, Players: []worldPlayer{}, Crystals: [][3]float64{}, Score: m.score, Winner: m.winner}
	for _, p := range m.players {
		msg.Players = append(msg.Players, worldPlayer{
			Name: html.EscapeString(p.name), X: r(p.x, 1), Y: r(p.y, 1), DX: p.dx, DY: p.dy, Face: p.face, Walked: r(p.walked, 1),
			Moving: p.moving, Carry: p.carry, Swing: r(p.swing, 3), AX: r(p.ax, 3), AY: r(p.ay, 3), Stun: r(p.stun, 2),
		})
	}
	for _, c := range m.crystals {
		msg.Crystals = append(msg.Crystals, [3]float64{float64(c.id), r(c.x, 1), r(c.y, 1)})
	}
	data, _ := json.Marshal(msg)
	return data
}

func encodeState(players []playerState) []byte {
	for i := range players {
		players[i].Name = html.EscapeString(players[i].Name)
	}
	data, _ := json.Marshal(stateMessage{Type: "state", Players: players})
	return data
}

func encodeGame(from string, payload json.RawMessage) []byte {
	data, _ := json.Marshal(gameMessage{Type: "game", From: html.EscapeString(from), Data: payload})
	return data
}
