package websocket

import (
	"encoding/json"
	"slices"
	"strings"
	"testing"
)

// sent records what the hub would deliver, per player, in order.
type sent map[string][]string

func newTestLobbies() (*lobbies, sent) {
	got := sent{}
	return newLobbies(func(to string, data []byte) { got[to] = append(got[to], string(data)) }), got
}

func (s sent) last(name string) string {
	if len(s[name]) == 0 {
		return ""
	}
	return s[name][len(s[name])-1]
}

func say(l *lobbies, name, msgType, host string) {
	l.handle(name, inMessage{Type: msgType, Host: host})
}

func TestHostNamesTheLobbyAfterTheHost(t *testing.T) {
	l, got := newTestLobbies()
	say(l, "ann", "host", "")
	want := `{"type":"lobby","lobby":{"host":"ann","name":"ann's lobby","members":["ann"],"max":4}}`
	if got.last("ann") != want {
		t.Fatalf("got %s, want %s", got.last("ann"), want)
	}
}

func TestSearchListsOpenLobbiesByHost(t *testing.T) {
	l, got := newTestLobbies()
	say(l, "bea", "host", "")
	say(l, "ann", "host", "")
	say(l, "cy", "search", "")
	want := `{"type":"lobbies","lobbies":[` +
		`{"host":"ann","name":"ann's lobby","members":["ann"],"max":4},` +
		`{"host":"bea","name":"bea's lobby","members":["bea"],"max":4}]}`
	if got.last("cy") != want {
		t.Fatalf("got %s, want %s", got.last("cy"), want)
	}
}

func TestSearchWithNoLobbiesIsAnEmptyList(t *testing.T) {
	l, got := newTestLobbies()
	say(l, "cy", "search", "")
	if want := `{"type":"lobbies","lobbies":[]}`; got.last("cy") != want {
		t.Fatalf("got %s, want %s", got.last("cy"), want)
	}
}

func TestJoinTellsEveryMember(t *testing.T) {
	l, got := newTestLobbies()
	say(l, "ann", "host", "")
	say(l, "bea", "join", "ann")
	want := `{"type":"lobby","lobby":{"host":"ann","name":"ann's lobby","members":["ann","bea"],"max":4}}`
	for _, name := range []string{"ann", "bea"} {
		if got.last(name) != want {
			t.Fatalf("%s got %s, want %s", name, got.last(name), want)
		}
	}
}

func TestAFullLobbyRefusesAndIsNotListed(t *testing.T) {
	l, got := newTestLobbies()
	say(l, "ann", "host", "")
	for _, name := range []string{"b", "c", "d"} {
		say(l, name, "join", "ann")
	}
	if len(l.byHost["ann"].members) != maxLobbyPlayers {
		t.Fatalf("members %v, want %d", l.byHost["ann"].members, maxLobbyPlayers)
	}
	say(l, "e", "join", "ann")
	if want := `{"type":"lobbies","lobbies":[],"refused":"full"}`; got.last("e") != want {
		t.Fatalf("got %s, want %s", got.last("e"), want)
	}
	if _, in := l.of["e"]; in || len(l.byHost["ann"].members) != maxLobbyPlayers {
		t.Fatalf("a refused player must not be in: %v", l.byHost["ann"].members)
	}
}

func TestJoinAGoneLobbyRefuses(t *testing.T) {
	l, got := newTestLobbies()
	say(l, "bea", "join", "ann")
	if want := `{"type":"lobbies","lobbies":[],"refused":"gone"}`; got.last("bea") != want {
		t.Fatalf("got %s, want %s", got.last("bea"), want)
	}
}

func TestLeavingTellsTheRestAndTheLeaver(t *testing.T) {
	l, got := newTestLobbies()
	say(l, "ann", "host", "")
	say(l, "bea", "join", "ann")
	say(l, "bea", "leave", "")
	if got.last("bea") != `{"type":"lobby","lobby":null}` {
		t.Fatalf("leaver got %s", got.last("bea"))
	}
	if want := `{"type":"lobby","lobby":{"host":"ann","name":"ann's lobby","members":["ann"],"max":4}}`; got.last("ann") != want {
		t.Fatalf("host got %s, want %s", got.last("ann"), want)
	}
}

func TestTheHostLeavingClosesTheLobby(t *testing.T) {
	l, got := newTestLobbies()
	say(l, "ann", "host", "")
	say(l, "bea", "join", "ann")
	say(l, "ann", "leave", "")
	for _, name := range []string{"ann", "bea"} {
		if got.last(name) != `{"type":"lobby","lobby":null}` {
			t.Fatalf("%s got %s", name, got.last(name))
		}
	}
	if len(l.byHost) != 0 || len(l.of) != 0 {
		t.Fatalf("a closed lobby leaves nothing behind: %v %v", l.byHost, l.of)
	}
}

func TestAPlayerIsInOneLobby(t *testing.T) {
	l, _ := newTestLobbies()
	say(l, "ann", "host", "")
	say(l, "bea", "host", "")
	say(l, "cy", "join", "ann")
	say(l, "cy", "join", "bea")
	if !slices.Equal(l.byHost["ann"].members, []string{"ann"}) || !slices.Equal(l.byHost["bea"].members, []string{"bea", "cy"}) {
		t.Fatalf("ann %v, bea %v", l.byHost["ann"].members, l.byHost["bea"].members)
	}
	// hosting while in another's lobby leaves it
	say(l, "cy", "host", "")
	if !slices.Equal(l.byHost["bea"].members, []string{"bea"}) || !slices.Equal(l.byHost["cy"].members, []string{"cy"}) {
		t.Fatalf("bea %v, cy %v", l.byHost["bea"].members, l.byHost["cy"].members)
	}
}

func TestHostingTwiceKeepsTheLobbyAndItsMembers(t *testing.T) {
	l, _ := newTestLobbies()
	say(l, "ann", "host", "")
	say(l, "bea", "join", "ann")
	say(l, "ann", "host", "")
	say(l, "ann", "join", "ann")
	if !slices.Equal(l.byHost["ann"].members, []string{"ann", "bea"}) {
		t.Fatalf("members %v", l.byHost["ann"].members)
	}
}

func TestADroppedConnectionLeavesItsLobby(t *testing.T) {
	l, got := newTestLobbies()
	say(l, "ann", "host", "")
	say(l, "bea", "join", "ann")
	players := map[string]*player{"ann": {client: &client{send: make(chan []byte, 16)}}, "bea": {}}
	tick(players, l, 0)
	if want := `{"type":"lobby","lobby":{"host":"ann","name":"ann's lobby","members":["ann"],"max":4}}`; got.last("ann") != want {
		t.Fatalf("host got %s, want %s", got.last("ann"), want)
	}
}

func TestDecodeLobbyMessages(t *testing.T) {
	for in, ok := range map[string]bool{
		`{"type":"host"}`:                true,
		`{"type":"search"}`:              true,
		`{"type":"leave"}`:               true,
		`{"type":"start"}`:               true,
		`{"type":"join","host":"ann"}`:   true,
		`{"type":"join"}`:                false,
		`{"type":"input","dx":1}`:        true,
		`{"type":"game"}`:                false,
		`{"type":"game","data":{"a":1}}`: true,
		`{"type":"nonsense"}`:            false,
		`not json`:                       false,
	} {
		if _, got := decode([]byte(in)); got != ok {
			t.Errorf("decode(%s) = %v, want %v", in, got, ok)
		}
	}
}

func TestLobbyMessagesAreJSON(t *testing.T) {
	var m lobbyMessage
	if err := json.Unmarshal(encodeLobby(nil), &m); err != nil || m.Type != "lobby" || m.Lobby != nil {
		t.Fatalf("%+v %v", m, err)
	}
}

// started: s is a match starting (not one ending, `"match":null`).
func started(s string) bool {
	return strings.HasPrefix(s, `{"type":"match","match":{`)
}

func TestStartSeatsEveryMemberInOrder(t *testing.T) {
	l, got := newTestLobbies()
	say(l, "ann", "host", "")
	say(l, "bea", "join", "ann")
	say(l, "cy", "join", "ann")
	say(l, "ann", "start", "")
	for _, name := range []string{"ann", "bea", "cy"} {
		var m matchMessage
		if err := json.Unmarshal([]byte(got.last(name)), &m); err != nil || m.Match == nil {
			t.Fatalf("%s got %s, want a match", name, got.last(name))
		}
		if len(m.Match.Seats) != 3 || len(m.Match.Players) != 3 || m.Match.Players[1] != (matchPlayerView{Name: "bea", Seat: 1}) {
			t.Fatalf("%s got %+v", name, *m.Match)
		}
	}
}

func TestOnlyTheHostStarts(t *testing.T) {
	l, got := newTestLobbies()
	say(l, "ann", "host", "")
	say(l, "bea", "join", "ann")
	say(l, "dov", "start", "")
	say(l, "bea", "start", "")
	for _, name := range []string{"ann", "bea", "dov"} {
		for _, m := range got[name] {
			if started(m) {
				t.Fatalf("%s was told of a start nobody with a lobby of their own made", name)
			}
		}
	}
}

func TestStartOnlyReachesItsOwnLobby(t *testing.T) {
	l, got := newTestLobbies()
	say(l, "ann", "host", "")
	say(l, "bea", "host", "")
	say(l, "ann", "start", "")
	if started(got.last("bea")) {
		t.Fatal("another lobby's member was told of ann's start")
	}
}
