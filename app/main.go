package main

import (
	"log"

	"github.com/YawningByDawn/CSE312-TeamProject/app/router"
	"github.com/YawningByDawn/CSE312-TeamProject/app/token"
	"github.com/YawningByDawn/CSE312-TeamProject/app/websocket"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/recover"
)

func main() {
	token.LoadPublicKey()
	go websocket.RunHub()

	app := fiber.New()
	app.Use(recover.New())
	router.Setup(app)
	websocket.Setup(app)
	log.Fatal(app.Listen(":8080"))
}
