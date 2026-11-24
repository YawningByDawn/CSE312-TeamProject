package router

import (
	"html"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/YawningByDawn/CSE312-TeamProject/auth/database"
	"github.com/YawningByDawn/CSE312-TeamProject/auth/token"
	"github.com/gofiber/fiber/v3"
)

type credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

var validUsername = regexp.MustCompile(`^[a-z0-9_]{3,20}$`)

func Setup(app *fiber.App) {
	app.Use(checkOrigin)
	app.Post("/register", register)
	app.Post("/login", login)
	app.Post("/logout", logout)
	app.Get("/*", func(c fiber.Ctx) error { return c.Redirect().To("/") })
}

// checkOrigin blocks cross-site POSTs (XSRF).
func checkOrigin(c fiber.Ctx) error {
	origin, err := url.Parse(c.Get("Origin"))
	if c.Method() == fiber.MethodPost && (err != nil || origin.Host != c.Host()) {
		return c.SendStatus(fiber.StatusForbidden)
	}
	return c.Next()
}

// readCredentials lowercases the username so "Bob" and "bob" are the same account.
func readCredentials(c fiber.Ctx) (credentials, error) {
	var body credentials
	err := c.Bind().Body(&body)
	body.Username = strings.ToLower(body.Username)
	return body, err
}

func register(c fiber.Ctx) error {
	body, err := readCredentials(c)
	if err != nil || !validUsername.MatchString(body.Username) || len(body.Password) < 8 || len(body.Password) > 72 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "username: 3-20 letters, digits or _ (not case-sensitive); password: 8-72 characters"})
	}
	created, err := database.RegisterUser(body.Username, body.Password)
	if err != nil {
		return c.SendStatus(fiber.StatusInternalServerError)
	}
	if !created {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "username taken"})
	}
	return c.JSON(fiber.Map{"username": html.EscapeString(body.Username)})
}

func login(c fiber.Ctx) error {
	body, err := readCredentials(c)
	if err != nil || !database.CheckUser(body.Username, body.Password) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "wrong username or password"})
	}
	jwtString, err := token.Sign(body.Username)
	if err != nil {
		return c.SendStatus(fiber.StatusInternalServerError)
	}
	setCookie(c, jwtString, time.Now().Add(token.Lifetime))
	return c.JSON(fiber.Map{"username": html.EscapeString(body.Username)})
}

func logout(c fiber.Ctx) error {
	setCookie(c, "", time.Unix(0, 0))
	return c.SendStatus(fiber.StatusNoContent)
}

func setCookie(c fiber.Ctx, value string, expires time.Time) {
	c.Cookie(&fiber.Cookie{
		Name:     "authToken",
		Value:    value,
		Path:     "/",
		Expires:  expires,
		HTTPOnly: true,
		SameSite: "Strict",
		Secure:   c.Get("X-Forwarded-Proto") == "https",
	})
}
