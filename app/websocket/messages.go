package websocket

import (
	"encoding/json"
	"html"
)

// All message encoding lives here, so a binary format can replace JSON in one place.

var kickedMessage = []byte(`{"type":"kicked"}`)

// inMessage is "input" (dx, dy) or "game" (data, relayed as it came to every other player).
type inMessage struct {
	Type string          `json:"type"`
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

func decode(data []byte) (inMessage, bool) {
	var msg inMessage
	err := json.Unmarshal(data, &msg)
	return msg, err == nil && (msg.Type == "input" || msg.Type == "game" && msg.Data != nil)
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
