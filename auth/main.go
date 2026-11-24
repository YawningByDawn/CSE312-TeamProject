package main

import (
	"log"

	"github.com/YawningByDawn/CSE312-TeamProject/auth/database"
	"github.com/YawningByDawn/CSE312-TeamProject/auth/router"
	"github.com/YawningByDawn/CSE312-TeamProject/auth/token"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/recover"
)

func main() {
	database.InitDatabase()
	token.InitKeys()

	app := fiber.New()
	app.Use(recover.New())
	router.Setup(app)
	log.Fatal(app.Listen(":8080"))
}
