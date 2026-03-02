# Makefile for traefik-log-dashboard agent

.PHONY: all build test clean run build-dashboard build-all

all: build

build:
	@echo "Building agent..."
	go build -o bin/agent ./cmd/agent

test:
	@echo "Running tests..."
	go test ./...

clean:
	@echo "Cleaning up..."
	go clean
	rm -f bin/agent

run: build
	@echo "Running agent..."
	./bin/agent

build-dashboard:
	@echo "Building dashboard..."
	cd ../dashboard && npm run build
	@echo "Copying dashboard dist to web/dist..."
	rm -rf web/dist
	mkdir -p web/dist
	cp -r ../dashboard/dist/* web/dist/

build-all: build-dashboard build