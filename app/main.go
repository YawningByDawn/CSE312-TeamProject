package main

import (
	_ "embed"
	"log"

	"github.com/YawningByDawn/CSE312-TeamProject/app/router"
	"github.com/YawningByDawn/CSE312-TeamProject/app/token"
	"github.com/YawningByDawn/CSE312-TeamProject/app/websocket"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/recover"
)

// The shared mine's ground and rules are the game's own tables (app/websocket/arena.go).
//
//go:embed game/src/content/walk.json
var walkJSON []byte

//go:embed game/src/content/arena.json
var arenaJSON []byte

func main() {
	token.LoadPublicKey()
	if err := websocket.Load(walkJSON, arenaJSON); err != nil {
		log.Fatal(err)
	}
	go websocket.RunHub()

	app := fiber.New()
	app.Use(recover.New())
	router.Setup(app)
	websocket.Setup(app)
	router.Game(app)
	log.Fatal(app.Listen(":8080"))
}
