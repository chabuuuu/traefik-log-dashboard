package main

import (
	"flag"
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/hhftechnology/traefik-log-dashboard/cli/internal/config"
	"github.com/hhftechnology/traefik-log-dashboard/cli/internal/model"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file if exists
	_ = godotenv.Load()

	// Load configuration from environment variables / defaults.
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading configuration: %v\n", err)
		os.Exit(1)
	}

	// CLI flags. Flags are parsed after config.Load() so they take
	// precedence over environment variables. An empty string flag means
	// "not provided", so we only override when the user actually passed a
	// value.
	url := flag.String("url", "", "Agent URL (overrides AGENT_URL env)")
	demo := flag.Bool("demo", false, "Start in demo mode")
	file := flag.String("file", "", "Read logs from file path")
	flag.Parse()

	if *url != "" {
		cfg.AgentURL = *url
	}
	if *demo {
		cfg.DemoMode = true
	}
	if *file != "" {
		cfg.AccessLogPath = *file
	}

	// Re-validate after flag overrides so we catch an invalid combination
	// early (e.g., the user wiped AgentURL with an empty --url="").
	if err := cfg.Validate(); err != nil {
		fmt.Fprintf(os.Stderr, "Invalid configuration: %v\n", err)
		os.Exit(1)
	}

	// Create initial model
	m := model.NewModel(cfg)

	// Create program
	p := tea.NewProgram(
		m,
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)

	// Run the program
	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error running program: %v\n", err)
		os.Exit(1)
	}
}
