package model

import (
	"context"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/hhftechnology/traefik-log-dashboard/cli/internal/config"
	"github.com/hhftechnology/traefik-log-dashboard/cli/internal/logs"
)

// ViewMode represents the current view
type ViewMode int

const (
	DashboardView ViewMode = iota
	AccessLogsView
	ErrorLogsView
)

// Model represents the application state
type Model struct {
	cfg             *config.Config
	currentView     ViewMode
	width           int
	height          int
	
	// Data
	accessLogs      []logs.TraefikLog
	errorLogs       []string
	metrics         *logs.Metrics
	systemStats     *logs.SystemStats
	
	// State
	loading         bool
	err             error
	lastUpdate      time.Time
	selectedIndex   int
	
	// Navigation
	activeTab       int
	
	// Flags
	quitting        bool
}

// NewModel creates a new Model
func NewModel(cfg *config.Config) Model {
	return Model{
		cfg:         cfg,
		currentView: DashboardView,
		loading:     true,
		lastUpdate:  time.Now(),
		activeTab:   0,
	}
}

// Init initializes the model
func (m Model) Init() tea.Cmd {
	return tea.Batch(
		m.fetchData(),
		m.tick(),
	)
}

// tick returns a command that waits for the refresh interval
func (m Model) tick() tea.Cmd {
	return tea.Tick(m.cfg.RefreshInterval, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

// fetchData fetches all data from the agent. Each invocation uses
// context.Background() because BubbleTea commands run in detached goroutines
// with no parent context. Cancellation is handled by the Quit command.
func (m Model) fetchData() tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()

		// Fetch access logs
		accessLogs, err := logs.FetchAccessLogs(ctx, m.cfg.AgentURL, m.cfg.AuthToken, m.cfg.MaxLogs)
		if err != nil {
			return errMsg{err}
		}

		// Fetch error logs
		errorLogs, err := logs.FetchErrorLogs(ctx, m.cfg.AgentURL, m.cfg.AuthToken, 100)
		if err != nil {
			return errMsg{err}
		}

		// Calculate metrics
		metrics := logs.CalculateMetrics(accessLogs)

		// Fetch system stats if enabled
		var systemStats *logs.SystemStats
		if m.cfg.SystemMonitoring {
			systemStats, _ = logs.FetchSystemStats(ctx, m.cfg.AgentURL, m.cfg.AuthToken)
		}

		return dataMsg{
			accessLogs:  accessLogs,
			errorLogs:   errorLogs,
			metrics:     metrics,
			systemStats: systemStats,
		}
	}
}