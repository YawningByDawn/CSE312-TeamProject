FROM node:24 AS game

WORKDIR /game

COPY game/package.json game/package-lock.json ./
RUN npm ci
COPY game/ .
RUN npm run build

FROM golang:1.26

WORKDIR /app

COPY go.mod main.go ./
COPY router router
COPY token token
COPY websocket websocket
COPY public public
COPY --from=game /game/dist public/game
RUN go mod tidy && go build -o server

RUN useradd --system app
USER app

CMD ["./server"]
