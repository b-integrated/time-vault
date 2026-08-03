FROM golang:1.24-alpine AS build

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /timevault ./cmd
RUN CGO_ENABLED=0 GOOS=linux go build -o /timevault-cli ./cmd/cli

FROM alpine:3.20

WORKDIR /app
COPY --from=build /timevault /usr/local/bin/timevault
COPY --from=build /timevault-cli /usr/local/bin/timevault-cli
EXPOSE 8080
CMD ["timevault"]
