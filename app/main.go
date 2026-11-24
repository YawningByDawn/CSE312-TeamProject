package main

import (
	"log"

	"github.com/DoritoMayhem/WebProject/app/router"
	"github.com/DoritoMayhem/WebProject/app/token"
	"github.com/DoritoMayhem/WebProject/app/websocket"
	"github.com/gofiber/fiber/v3"
)

func main() {
	token.LoadPublicKey()
	go websocket.RunHub()

	app := fiber.New()
	router.Setup(app)
	websocket.Setup(app)
	log.Fatal(app.Listen(":8080"))
}
