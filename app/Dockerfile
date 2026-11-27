# The game on this branch is Gobble Grove (arena/); the old game (game/) is not built.
FROM node:24.11.1 AS game

WORKDIR /arena

COPY arena/package.json arena/package-lock.json ./
RUN npm ci
COPY arena/ .
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
COPY --from=game /arena/dist public/game

RUN useradd --system app
USER app

CMD ["./server"]
