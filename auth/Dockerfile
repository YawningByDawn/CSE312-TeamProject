FROM golang:1.26 AS build

WORKDIR /app

COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -o server

# The image keeps only the server, not the Go toolchain.
FROM debian:bookworm-slim

WORKDIR /app
COPY --from=build /app/server .

# Empty volumes copy this ownership on first mount, so only the auth user can write the keys.
RUN useradd --system auth && mkdir -p /keys/private /keys/public && chown auth /keys/private /keys/public
USER auth

CMD ["./server"]
