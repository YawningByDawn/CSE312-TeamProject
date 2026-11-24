package main

import (
	"log"

	"github.com/DoritoMayhem/WebProject/auth/database"
	"github.com/DoritoMayhem/WebProject/auth/router"
	"github.com/DoritoMayhem/WebProject/auth/token"
	"github.com/gofiber/fiber/v3"
)

func main() {
	database.InitDatabase()
	token.InitKeys()

	app := fiber.New()
	router.Setup(app)
	log.Fatal(app.Listen(":8080"))
}
