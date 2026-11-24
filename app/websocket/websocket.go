package websocket

import (
	"net/url"
	"time"

	"github.com/YawningByDawn/CSE312-TeamProject/app/token"
	fiberws "github.com/gofiber/contrib/v3/websocket"
	"github.com/gofiber/fiber/v3"
)

const (
	pingInterval         = 10 * time.Second
	maxMessageSize       = 1024
	maxMessagesPerSecond = 60
)

func Setup(app *fiber.App) {
	app.Get("/ws", checkUpgrade, fiberws.New(handleConn))
}

// checkUpgrade rejects the handshake before upgrading: wrong Origin, no valid JWT, or not a WebSocket request.
func checkUpgrade(c fiber.Ctx) error {
	origin, err := url.Parse(c.Get("Origin"))
	if err != nil || origin.Host != c.Host() {
		return c.SendStatus(fiber.StatusForbidden)
	}
	username, err := token.Verify(c.Cookies("authToken"))
	if err != nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	if !fiberws.IsWebSocketUpgrade(c) {
		return fiber.ErrUpgradeRequired
	}
	c.Locals("username", username)
	return c.Next()
}

func handleConn(conn *fiberws.Conn) {
	c := &client{username: conn.Locals("username").(string), send: make(chan []byte, 16)}
	joinChan <- c

	writerDone := make(chan struct{})
	go func() {
		writeLoop(conn, c.send)
		close(writerDone)
	}()

	readLoop(conn, c)
	leaveChan <- c
	<-writerDone // Fiber reuses conn after this function returns, so the writer must be finished
}

func readLoop(conn *fiberws.Conn, c *client) {
	conn.SetReadLimit(maxMessageSize)
	conn.SetReadDeadline(time.Now().Add(2 * pingInterval))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(2 * pingInterval))
	})

	count, windowStart := 0, time.Now()
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			return
		}
		if time.Since(windowStart) > time.Second {
			count, windowStart = 0, time.Now()
		}
		count++
		if count > maxMessagesPerSecond {
			continue
		}
		if msg, ok := decode(data); ok {
			inputChan <- input{username: c.username, msg: msg}
		}
	}
}

// writeLoop is the only goroutine that writes to conn. It stops when the hub closes send.
func writeLoop(conn *fiberws.Conn, send chan []byte) {
	defer conn.Close()
	ping := time.NewTicker(pingInterval)
	defer ping.Stop()
	for {
		select {
		case data, ok := <-send:
			if !ok || conn.WriteMessage(fiberws.TextMessage, data) != nil {
				return
			}
		case <-ping.C:
			if conn.WriteMessage(fiberws.PingMessage, nil) != nil {
				return
			}
		}
	}
}
