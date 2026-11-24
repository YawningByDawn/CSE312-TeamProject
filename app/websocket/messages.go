package websocket

import (
	"encoding/json"
	"html"
)

// All message encoding lives here, so a binary format can replace JSON in one place.

var kickedMessage = []byte(`{"type":"kicked"}`)

type inMessage struct {
	Type string  `json:"type"`
	DX   float64 `json:"dx"`
	DY   float64 `json:"dy"`
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

func decode(data []byte) (inMessage, bool) {
	var msg inMessage
	err := json.Unmarshal(data, &msg)
	return msg, err == nil && msg.Type == "input"
}

func encodeState(players []playerState) []byte {
	for i := range players {
		players[i].Name = html.EscapeString(players[i].Name)
	}
	data, _ := json.Marshal(stateMessage{Type: "state", Players: players})
	return data
}
