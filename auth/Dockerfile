FROM golang:1.26

WORKDIR /app

COPY . .
RUN go mod tidy && go build -o server

CMD ["./server"]
