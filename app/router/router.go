package router

import (
	"html"

	"github.com/YawningByDawn/CSE312-TeamProject/app/token"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/static"
)

func Setup(app *fiber.App) {
	app.Get("/", func(c fiber.Ctx) error { return c.SendFile("./public/index.html") })
	app.Get("/api/me", me)
	app.Use("/game", static.New("./public/game"))
}

func me(c fiber.Ctx) error {
	username, err := token.Verify(c.Cookies("authToken"))
	if err != nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	return c.JSON(fiber.Map{"username": html.EscapeString(username)})
}
