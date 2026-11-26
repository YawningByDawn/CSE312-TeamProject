FROM node:24 AS game

WORKDIR /game

COPY game/package.json game/package-lock.json ./
RUN npm ci
COPY game/ .
RUN npm run build

FROM golang:1.26 AS build

WORKDIR /app

COPY go.mod main.go ./
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
