FROM golang:1.23-bookworm AS build

WORKDIR /src
COPY go.mod ./
COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/engine-go .

FROM gcr.io/distroless/base-debian12
WORKDIR /app
COPY --from=build /out/engine-go /app/engine-go
ENV ENGINE_PORT=8088
EXPOSE 8088
ENTRYPOINT ["/app/engine-go"]
