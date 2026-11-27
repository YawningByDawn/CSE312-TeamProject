package websocket

import (
	"encoding/json"
	"html"
)

// All message encoding lives here, so a binary format can replace JSON in one place.

var kickedMessage = []byte(`{"type":"kicked"}`)

// startMessage tells the members of a lobby that its host started it.
var startMessage = []byte(`{"type":"start"}`)

// inMessage is "input" (dx, dy), "game" (data, relayed as it came to every other player), or a lobby's "host", "search",
// "join" (host), "leave" and, from a lobby's host, "start".
type inMessage struct {
	Type string          `json:"type"`
	Host string          `json:"host"`
	DX   float64         `json:"dx"`
	DY   float64         `json:"dy"`
	Data json.RawMessage `json:"data"`
}

type playerState struct {
	Name string  `json:"name"`
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
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
	case "input", "host", "search", "leave", "start":
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
