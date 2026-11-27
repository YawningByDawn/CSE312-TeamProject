# the npm that wrote game/package-lock.json; a newer one refuses it under `npm ci`
FROM node:24.11.1 AS game

WORKDIR /game

COPY game/package.json game/package-lock.json ./
RUN npm ci
COPY game/ .
RUN npm run build

FROM golang:1.26 AS build

WORKDIR /app

COPY go.mod main.go ./
# the shared mine's tables, which the server embeds (main.go)
COPY game/src/content/walk.json game/src/content/arena.json game/src/content/
COPY router router
COPY token token
COPY websocket websocket
RUN go mod tidy && CGO_ENABLED=0 go build -o server

# The image keeps only the server and the game it serves, not the Go or Node toolchains.
FROM debian:bookworm-slim

WORKDIR /app
COPY --from=build /app/server .
COPY --from=game /game/dist public/game

RUN useradd --system app
USER app

CMD ["./server"]
