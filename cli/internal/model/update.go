package model

import (
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/hhftechnology/traefik-log-dashboard/cli/internal/logs"
)

// Messages

type tickMsg time.Time

type dataMsg struct {
	accessLogs  []logs.TraefikLog
	errorLogs   []string
	metrics     *logs.Metrics
	systemStats *logs.SystemStats
}

type errMsg struct {
	err error
}

// Update handles messages and updates the model
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case tea.KeyMsg:
		return m.handleKeyPress(msg)

	case tickMsg:
		// Auto-refresh data
		return m, tea.Batch(
			m.fetchData(),
			m.tick(),
		)

	case dataMsg:
		m.accessLogs = msg.accessLogs
		m.errorLogs = msg.errorLogs
		m.metrics = msg.metrics
		m.systemStats = msg.systemStats
		m.loading = false
		m.err = nil
		m.lastUpdate = time.Now()
		return m, nil

	case errMsg:
		m.err = msg.err
		m.loading = false
		return m, nil
	}

	return m, nil
}

// handleKeyPress handles keyboard input
func (m Model) handleKeyPress(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "q", "ctrl+c":
		m.quitting = true
		return m, tea.Quit

	case "r":
		// Refresh data
		m.loading = true
		return m, m.fetchData()

	case "tab":
		// Cycle through tabs
		m.activeTab = (m.activeTab + 1) % 3
		return m, nil

	case "1":
		m.currentView = DashboardView
		return m, nil

	case "2":
		m.currentView = AccessLogsView
		m.selectedIndex = 0
		return m, nil

	case "3":
		m.currentView = ErrorLogsView
		m.selectedIndex = 0
		return m, nil

	case "up", "k":
		if m.selectedIndex > 0 {
			m.selectedIndex--
		}
		return m, nil

	case "down", "j":
		maxIndex := 0
		switch m.currentView {
		case AccessLogsView:
			maxIndex = len(m.accessLogs) - 1
		case ErrorLogsView:
			maxIndex = len(m.errorLogs) - 1
		}
		if m.selectedIndex < maxIndex {
			m.selectedIndex++
		}
		return m, nil

	case "home", "g":
		m.selectedIndex = 0
		return m, nil

	case "end", "G":
		switch m.currentView {
		case AccessLogsView:
			m.selectedIndex = len(m.accessLogs) - 1
		case ErrorLogsView:
			m.selectedIndex = len(m.errorLogs) - 1
		}
		return m, nil

	case "d":
		// Toggle demo mode. When switching ON, populate immediately from the
		// demo data generator so the view is never blank. When switching OFF,
		// fire a real fetch so the UI reflects live data without waiting for
		// the next tick.
		m.cfg.DemoMode = !m.cfg.DemoMode
		if m.cfg.DemoMode {
			m.accessLogs = logs.GenerateDemoLogs(100)
			m.metrics = logs.CalculateMetrics(m.accessLogs)
			return m, nil
		}
		m.loading = true
		return m, m.fetchData()
	}

	return m, nil
}