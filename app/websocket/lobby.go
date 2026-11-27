package websocket

import (
	"cmp"
	"slices"
)

const maxLobbyPlayers = 4

type lobby struct {
	host    string
	members []string // the host first
}

// lobbies is the hub's lobby table. A lobby belongs to its host, so there is one per player and the host's name is its id;
// a player is in at most one. Only the hub goroutine touches it. out delivers a message to a connected player by name.
type lobbies struct {
	byHost map[string]*lobby
	of     map[string]string // player -> host of the lobby they are in
	out    func(to string, data []byte)
}

func newLobbies(out func(to string, data []byte)) *lobbies {
	return &lobbies{byHost: map[string]*lobby{}, of: map[string]string{}, out: out}
}

// handle runs a lobby message from player `name`.
func (l *lobbies) handle(name string, msg inMessage) {
	switch msg.Type {
	case "host":
		l.host(name)
	case "join":
		l.join(name, msg.Host)
	case "search":
		l.out(name, encodeLobbies(l.open(), ""))
	case "leave":
		l.leave(name)
	case "start":
		l.start(name)
	}
}

// host opens a lobby for `name`, closing the one they were in unless it is their own.
func (l *lobbies) host(name string) {
	if l.of[name] == name {
		l.show(l.byHost[name])
		return
	}
	l.leave(name)
	lb := &lobby{host: name, members: []string{name}}
	l.byHost[name] = lb
	l.of[name] = name
	l.show(lb)
}

// join puts `name` in host's lobby. A lobby that is gone or full refuses with the fresh list of open ones.
func (l *lobbies) join(name, host string) {
	lb := l.byHost[host]
	switch {
	case lb == nil:
		l.out(name, encodeLobbies(l.open(), "gone"))
	case l.of[name] == host:
		l.show(lb)
	case len(lb.members) >= maxLobbyPlayers:
		l.out(name, encodeLobbies(l.open(), "full"))
	default:
		l.leave(name)
		lb.members = append(lb.members, name)
		l.of[name] = host
		l.show(lb)
	}
}

// start tells every member of `name`'s lobby that it has started. Only the host may: a lobby is its host's, so anyone
// else finds none under their name and is ignored. What starts is up to the game; the hub only carries the word.
func (l *lobbies) start(name string) {
	lb := l.byHost[name]
	if lb == nil {
		return
	}
	for _, m := range lb.members {
		l.out(m, startMessage)
	}
}

// leave takes `name` out of their lobby. The host leaving closes it and sends everyone out.
func (l *lobbies) leave(name string) {
	host, in := l.of[name]
	if !in {
		return
	}
	lb := l.byHost[host]
	delete(l.of, name)
	l.out(name, encodeLobby(nil))
	if name != host {
		lb.members = slices.DeleteFunc(lb.members, func(m string) bool { return m == name })
		l.show(lb)
		return
	}
	delete(l.byHost, host)
	for _, m := range lb.members {
		if m != name {
			delete(l.of, m)
			l.out(m, encodeLobby(nil))
		}
	}
}

// show sends the lobby as it stands to each of its members.
func (l *lobbies) show(lb *lobby) {
	data := encodeLobby(lb)
	for _, m := range lb.members {
		l.out(m, data)
	}
}

// open lists the lobbies with room, by host.
func (l *lobbies) open() []*lobby {
	list := []*lobby{}
	for _, lb := range l.byHost {
		if len(lb.members) < maxLobbyPlayers {
			list = append(list, lb)
		}
	}
	slices.SortFunc(list, func(a, b *lobby) int { return cmp.Compare(a.host, b.host) })
	return list
}
