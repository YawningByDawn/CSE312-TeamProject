package websocket

import (
	"encoding/json"
	"fmt"
	"math"
	"slices"
)

// The shared mine's ground and rules, from the game's own tables (main embeds them): walk.json says which zone of the mine
// each cell of floor is (255 is rock), arena.json each seat's shrine and zones by how many play, and the match's numbers.
// Load sets them once, before the hub runs; nothing changes them after.

const rock = 255

type rules struct {
	Speed        float64 `json:"speed"`
	Feet         float64 `json:"feet"`
	Pick         float64 `json:"pick"`
	Carry        int     `json:"carry"`
	Shrine       float64 `json:"shrine"`
	Goal         int     `json:"goal"`
	Crystals     int     `json:"crystals"`
	CrystalsEach int     `json:"crystalsEach"`
	SpawnEvery   float64 `json:"spawnEvery"`
	SpawnClear   float64 `json:"spawnClear"`
	Swing        float64 `json:"swing"`
	Blow         float64 `json:"blow"`
	Reach        float64 `json:"reach"`
	Arc          float64 `json:"arc"`
	Stun         float64 `json:"stun"`
	Knock        float64 `json:"knock"`
	Scatter      float64 `json:"scatter"`
	Over         float64 `json:"over"`
}

type seat struct {
	Shrine [2]float64 `json:"shrine"`
	Zones  []string   `json:"zones"`
}

// layout is the mine for one count of players: its seats, which zones are open, and the cells a crystal may appear on.
type layout struct {
	seats []seat
	open  []bool
	spots []int
}

type ground struct {
	cell   float64
	gw, gh int
	zone   []uint8
}

var arena struct {
	ground  ground
	rules   rules
	layouts []layout
}

// Load reads walk.json and arena.json. Every seat's shrine must stand on open floor of its own domain.
func Load(walkJSON, arenaJSON []byte) error {
	var w struct {
		Cell  float64  `json:"cell"`
		GW    int      `json:"gw"`
		GH    int      `json:"gh"`
		Zones []string `json:"zones"`
		Runs  []int    `json:"runs"`
	}
	var a struct {
		Rules   rules    `json:"rules"`
		Layouts [][]seat `json:"layouts"`
	}
	if err := json.Unmarshal(walkJSON, &w); err != nil {
		return fmt.Errorf("walk.json: %w", err)
	}
	if err := json.Unmarshal(arenaJSON, &a); err != nil {
		return fmt.Errorf("arena.json: %w", err)
	}
	g := ground{cell: w.Cell, gw: w.GW, gh: w.GH}
	for i := 0; i+1 < len(w.Runs); i += 2 {
		for range w.Runs[i+1] {
			g.zone = append(g.zone, uint8(w.Runs[i]))
		}
	}
	if len(g.zone) != g.gw*g.gh {
		return fmt.Errorf("walk.json: %d cells, want %d", len(g.zone), g.gw*g.gh)
	}
	if len(a.Layouts) != maxLobbyPlayers {
		return fmt.Errorf("arena.json: %d layouts, want %d", len(a.Layouts), maxLobbyPlayers)
	}
	arena.ground, arena.rules, arena.layouts = g, a.Rules, nil
	for n, seats := range a.Layouts {
		if len(seats) != n+1 {
			return fmt.Errorf("arena.json: layout %d has %d seats", n+1, len(seats))
		}
		lay := layout{seats: seats, open: make([]bool, len(w.Zones))}
		for _, s := range seats {
			for _, z := range s.Zones {
				i := slices.Index(w.Zones, z)
				if i < 0 {
					return fmt.Errorf("arena.json: no zone %q", z)
				}
				lay.open[i] = true
			}
		}
		for i, s := range seats {
			if z := g.at(s.Shrine[0], s.Shrine[1]); z == rock || !slices.Contains(s.Zones, w.Zones[z]) || !lay.stands(s.Shrine[0], s.Shrine[1]) {
				return fmt.Errorf("arena.json: layout %d seat %d's shrine is not on its own floor", n+1, i)
			}
		}
		lay.spots = lay.findSpots()
		arena.layouts = append(arena.layouts, lay)
	}
	return nil
}

// at is the zone of the cell under (x, y), rock off the mine.
func (g *ground) at(x, y float64) uint8 {
	cx, cy := int(math.Floor(x/g.cell)), int(math.Floor(y/g.cell))
	if cx < 0 || cy < 0 || cx >= g.gw || cy >= g.gh {
		return rock
	}
	return g.zone[cy*g.gw+cx]
}

// floor is open ground of this layout at (x, y).
func (l *layout) floor(x, y float64) bool {
	z := arena.ground.at(x, y)
	return z != rock && l.open[z]
}

// stands: feet at (x, y) touch no rock, the feet a circle of the rules' radius (its centre and four rim points).
func (l *layout) stands(x, y float64) bool {
	r := arena.rules.Feet
	return l.floor(x, y) && l.floor(x+r, y) && l.floor(x-r, y) && l.floor(x, y+r) && l.floor(x, y-r)
}

// findSpots lists the open cells a crystal may appear on: two cells clear of rock all round, and far enough from every shrine.
func (l *layout) findSpots() []int {
	g := &arena.ground
	spots := []int{}
	for cy := 2; cy < g.gh-2; cy++ {
	cell:
		for cx := 2; cx < g.gw-2; cx++ {
			x, y := (float64(cx)+0.5)*g.cell, (float64(cy)+0.5)*g.cell
			for _, s := range l.seats {
				if math.Hypot(x-s.Shrine[0], y-s.Shrine[1]) < arena.rules.SpawnClear {
					continue cell
				}
			}
			for dy := -2; dy <= 2; dy++ {
				for dx := -2; dx <= 2; dx++ {
					if z := g.zone[(cy+dy)*g.gw+cx+dx]; z == rock || !l.open[z] {
						continue cell
					}
				}
			}
			spots = append(spots, cy*g.gw+cx)
		}
	}
	return spots
}
