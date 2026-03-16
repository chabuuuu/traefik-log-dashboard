# Makefile for traefik-log-dashboard agent

.PHONY: all build test test-race bench lint vet test-coverage check clean run build-dashboard build-all

all: build

build:
	@echo "Building agent..."
	go build -o bin/agent ./cmd/agent

test:
	@echo "Running tests..."
	go test ./...

test-race:
	@echo "Running tests with race detector..."
	go test -race ./...

bench:
	@echo "Running benchmarks..."
	go test -bench=. -benchmem ./...

lint:
	@if command -v golangci-lint > /dev/null 2>&1; then \
		echo "Running golangci-lint..."; \
		golangci-lint run ./...; \
	else \
		echo "golangci-lint not installed, skipping"; \
	fi

vet:
	@echo "Running go vet..."
	go vet ./...

test-coverage:
	@echo "Generating test coverage..."
	go test -cover -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

check: vet lint test
	@echo "All checks passed."

clean:
	@echo "Cleaning up..."
	go clean
	rm -f bin/agent coverage.out coverage.html

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