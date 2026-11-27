package websocket

import (
	"fmt"
	"math/rand/v2"
	"regexp"
	"sync"
)

// Guests play without an account. A guest's page makes up a random key, keeps it for the tab, and opens the socket
// with it (`/ws?guest=<key>`); the key names one guest, so a dropped socket that reconnects with it gets the same
// name back, and with it the same creature, as a logged-in player does. Guest names are "Guest" and digits: usernames
// are lower case, so no account can have one. A guest's name is let go once the hub has forgotten them.

var guestKey = regexp.MustCompile(`^[0-9a-f]{32}$`)

type guestBook struct {
	mu     sync.Mutex
	byKey  map[string]string // key -> name
	byName map[string]string // name -> key
}

var guests = &guestBook{byKey: map[string]string{}, byName: map[string]string{}}

// name is the guest name for a key, making one up the first time.
func (g *guestBook) name(key string) string {
	g.mu.Lock()
	defer g.mu.Unlock()
	if name, ok := g.byKey[key]; ok {
		return name
	}
	digits := 4
	for tries := 0; ; tries++ {
		if tries > 0 && tries%50 == 0 {
			digits++ // crowded: longer names
		}
		name := fmt.Sprintf("Guest%0*d", digits, rand.IntN(pow10(digits)))
		if _, taken := g.byName[name]; !taken {
			g.byKey[key], g.byName[name] = name, key
			return name
		}
	}
}

// release lets a guest's name go; any other name is left alone.
func (g *guestBook) release(name string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if key, ok := g.byName[name]; ok {
		delete(g.byName, name)
		delete(g.byKey, key)
	}
}

func pow10(n int) int {
	p := 1
	for range n {
		p *= 10
	}
	return p
}
