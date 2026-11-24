FROM golang:1.26

WORKDIR /app

COPY . .
RUN go mod tidy && go build -o server

# Empty volumes copy this ownership on first mount, so only the auth user can write the keys.
RUN useradd --system auth && mkdir -p /keys/private /keys/public && chown auth /keys/private /keys/public
USER auth

CMD ["./server"]
