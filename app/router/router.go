package router

import (
	"html"

	"github.com/YawningByDawn/CSE312-TeamProject/app/token"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/static"
)

func Setup(app *fiber.App) {
	app.Get("/account", func(c fiber.Ctx) error { return c.SendFile("./public/index.html") })
	app.Get("/api/me", me)
}

// Game serves the built game at the site's root; registered after every other route.
func Game(app *fiber.App) {
	app.Use("/", static.New("./public/game"))
}

// me names who is logged in; a username of null means nobody.
func me(c fiber.Ctx) error {
	username, err := token.Verify(c.Cookies("authToken"))
	if err != nil {
		return c.JSON(fiber.Map{"username": nil})
	}
	return c.JSON(fiber.Map{"username": html.EscapeString(username)})
}
