package websocket

import (
	"cmp"
	"math/rand/v2"
	"slices"
	"time"
)

const maxLobbyPlayers = 4

type lobby struct {
	host    string
	members []string // the host first
	match   *match   // the shared mine while its host's Start plays; nil in the lobby
}

// lobbies is the hub's lobby table. A lobby belongs to its host, so there is one per player and the host's name is its id;
// a player is in at most one. Only the hub goroutine touches it. out delivers a message to a connected player by name.
type lobbies struct {
	byHost map[string]*lobby
	of     map[string]string // player -> host of the lobby they are in
	out    func(to string, data []byte)
	rate   int // ticks a second: the matches' step, which the players' interpolation reads
	rng    *rand.Rand
}

func newLobbies(out func(to string, data []byte)) *lobbies {
	now := uint64(time.Now().UnixNano())
	return &lobbies{byHost: map[string]*lobby{}, of: map[string]string{}, out: out, rate: defaultTickRate, rng: rand.New(rand.NewPCG(now, now>>1))}
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
	case "input":
		if m := l.matchOf(name); m != nil {
			m.input(name, msg.DX, msg.DY)
		}
	case "strike":
		if m := l.matchOf(name); m != nil {
			m.strike(name, msg.DX, msg.DY)
		}
	}
}

// matchOf is the match `name` plays in, nil for none.
func (l *lobbies) matchOf(name string) *match {
	if host, in := l.of[name]; in {
		return l.byHost[host].match
	}
	return nil
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
	case lb.match != nil:
		l.out(name, encodeLobbies(l.open(), "playing"))
	case len(lb.members) >= maxLobbyPlayers:
		l.out(name, encodeLobbies(l.open(), "full"))
	default:
		l.leave(name)
		lb.members = append(lb.members, name)
		l.of[name] = host
		l.show(lb)
	}
}

// start seats every member of `name`'s lobby in a new match and tells them. Only the host may: a lobby is its host's, so
// anyone else finds none under their name and is ignored. A lobby plays one match at a time.
func (l *lobbies) start(name string) {
	lb := l.byHost[name]
	if lb == nil || lb.match != nil {
		return
	}
	lb.match = newMatch(lb.members, l.rng)
	l.tell(lb, encodeMatch(lb.match, l.rate))
}

// step runs every match one tick and sends each member the mine as it stands; a match whose winner has been shown ends,
// its players back in their lobby.
func (l *lobbies) step(dt float64) {
	for _, lb := range l.byHost {
		m := lb.match
		if m == nil {
			continue
		}
		m.step(dt)
		l.tell(lb, encodeWorld(m))
		if m.done() {
			lb.match = nil
			l.tell(lb, encodeMatch(nil, 0))
		}
	}
}

// resume shows `name` their lobby again, and the match it plays (a new tab taking the player over).
func (l *lobbies) resume(name string) {
	host, in := l.of[name]
	if !in {
		return
	}
	lb := l.byHost[host]
	l.show(lb)
	if lb.match != nil {
		l.out(name, encodeMatch(lb.match, l.rate))
	}
}

// tell sends data to every member of lb.
func (l *lobbies) tell(lb *lobby, data []byte) {
	for _, m := range lb.members {
		l.out(m, data)
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
	if lb.match != nil {
		lb.match.remove(name)
		l.out(name, encodeMatch(nil, 0))
	}
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
			if lb.match != nil {
				l.out(m, encodeMatch(nil, 0))
			}
			l.out(m, encodeLobby(nil))
		}
	}
}

// show sends the lobby as it stands to each of its members.
func (l *lobbies) show(lb *lobby) {
	l.tell(lb, encodeLobby(lb))
}

// open lists the lobbies with room and no match playing, by host.
func (l *lobbies) open() []*lobby {
	list := []*lobby{}
	for _, lb := range l.byHost {
		if len(lb.members) < maxLobbyPlayers && lb.match == nil {
			list = append(list, lb)
		}
	}
	slices.SortFunc(list, func(a, b *lobby) int { return cmp.Compare(a.host, b.host) })
	return list
}
