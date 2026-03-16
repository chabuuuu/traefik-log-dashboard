package model

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/hhftechnology/traefik-log-dashboard/cli/internal/logs"
	"github.com/hhftechnology/traefik-log-dashboard/cli/internal/ui/dashboard"
	"github.com/hhftechnology/traefik-log-dashboard/cli/internal/ui/styles"
)

// View renders the current view
func (m Model) View() string {
	if m.quitting {
		return "Goodbye!\n"
	}

	var content string

	// Render header
	header := m.renderHeader()

	// Render main content based on current view
	switch m.currentView {
	case DashboardView:
		content = m.renderDashboard()
	case AccessLogsView:
		content = m.renderAccessLogs()
	case ErrorLogsView:
		content = m.renderErrorLogs()
	}

	// Render footer
	footer := m.renderFooter()

	// Combine all sections
	availableHeight := m.height - lipgloss.Height(header) - lipgloss.Height(footer) - 2

	contentStyle := lipgloss.NewStyle().
		Width(m.width).
		Height(availableHeight)

	return lipgloss.JoinVertical(
		lipgloss.Left,
		header,
		contentStyle.Render(content),
		footer,
	)
}

// renderHeader renders the application header
func (m Model) renderHeader() string {
	title := styles.TitleStyle.Render(" Traefik Log Dashboard CLI")

	status := "Connected"
	statusColor := styles.SuccessStyle
	if m.err != nil {
		status = "Disconnected"
		statusColor = styles.ErrorStyle
	} else if m.loading {
		status = "Loading..."
		statusColor = styles.MutedStyle
	}

	statusText := statusColor.Render(status)

	lastUpdate := ""
	if !m.lastUpdate.IsZero() {
		lastUpdate = styles.MutedStyle.Render(
			fmt.Sprintf("Last updated: %s", m.lastUpdate.Format("15:04:05")),
		)
	}

	headerLeft := lipgloss.JoinHorizontal(
		lipgloss.Left,
		title,
		"  ",
		statusText,
	)

	headerRight := lastUpdate

	headerStyle := lipgloss.NewStyle().
		Width(m.width).
		Padding(1, 2).
		Background(lipgloss.Color("235")).
		Foreground(lipgloss.Color("255"))

	header := lipgloss.JoinHorizontal(
		lipgloss.Left,
		headerLeft,
		strings.Repeat(" ", max(0, m.width-lipgloss.Width(headerLeft)-lipgloss.Width(headerRight)-4)),
		headerRight,
	)

	return headerStyle.Render(header)
}

// renderDashboard renders the dashboard view
func (m Model) renderDashboard() string {
	if m.err != nil {
		return styles.ErrorStyle.Render(
			fmt.Sprintf("Error: %v\n\nPress 'r' to retry", m.err),
		)
	}

	if m.loading {
		return styles.MutedStyle.Render("Loading dashboard...")
	}

	if m.metrics == nil {
		return styles.MutedStyle.Render("No data available")
	}

	return dashboard.Render(m.metrics, m.systemStats, m.width, m.height-8)
}

// renderAccessLogs renders the access logs view
func (m Model) renderAccessLogs() string {
	if len(m.accessLogs) == 0 {
		return styles.MutedStyle.Render("No access logs available")
	}

	var sb strings.Builder
	sb.WriteString(styles.SubtitleStyle.Render(fmt.Sprintf("Access Logs (%d)", len(m.accessLogs))))
	sb.WriteString("\n\n")

	// Display logs (limited to visible area)
	maxVisible := min(m.height-12, len(m.accessLogs))
	start := max(0, m.selectedIndex-maxVisible+1)
	end := min(len(m.accessLogs), start+maxVisible)

	for i := start; i < end; i++ {
		log := m.accessLogs[i]

		style := styles.DefaultStyle
		if i == m.selectedIndex {
			style = styles.SelectedStyle
		}

		line := fmt.Sprintf(
			"%s %s %s %d %dms",
			log.RequestMethod,
			truncate(log.RequestPath, 40),
			log.ClientHost,
			log.DownstreamStatus,
			log.Duration/1000000,
		)

		sb.WriteString(style.Render(line))
		sb.WriteString("\n")
	}

	return sb.String()
}

// renderErrorLogs renders the error logs view
func (m Model) renderErrorLogs() string {
	if len(m.errorLogs) == 0 {
		return styles.MutedStyle.Render("No error logs available")
	}

	var sb strings.Builder
	sb.WriteString(styles.SubtitleStyle.Render(fmt.Sprintf("Error Logs (%d)", len(m.errorLogs))))
	sb.WriteString("\n\n")

	// Display logs (limited to visible area)
	maxVisible := min(m.height-12, len(m.errorLogs))
	start := max(0, m.selectedIndex-maxVisible+1)
	end := min(len(m.errorLogs), start+maxVisible)

	for i := start; i < end; i++ {
		style := styles.DefaultStyle
		if i == m.selectedIndex {
			style = styles.SelectedStyle
		}

		sb.WriteString(style.Render(formatErrorLogLine(m.errorLogs[i], m.width)))
		sb.WriteString("\n")
	}

	return sb.String()
}

// renderFooter renders the application footer with keybindings
func (m Model) renderFooter() string {
	keybindings := []string{
		"1: Dashboard",
		"2: Access Logs",
		"3: Error Logs",
		"r: Refresh",
		"d: Demo",
		"q: Quit",
	}

	footerText := strings.Join(keybindings, " • ")

	footerStyle := lipgloss.NewStyle().
		Width(m.width).
		Padding(0, 2).
		Background(lipgloss.Color("235")).
		Foreground(lipgloss.Color("243"))

	return footerStyle.Render(footerText)
}

// Helper functions

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func formatErrorLogLine(logEntry logs.TraefikLog, width int) string {
	timestamp := "??:??:??"
	if t, ok := parseTimestamp(logEntry.StartUTC); ok {
		timestamp = t.Format("15:04:05")
	} else if t, ok := parseTimestamp(logEntry.StartLocal); ok {
		timestamp = t.Format("15:04:05")
	}

	status := logEntry.DownstreamStatus
	if status <= 0 {
		status = logEntry.OriginStatus
	}

	method := logEntry.RequestMethod
	if method == "" {
		method = "-"
	}

	path := logEntry.RequestPath
	if path == "" {
		path = "/"
	}

	client := logEntry.ClientHost
	if client == "" {
		client = "-"
	}

	prefix := fmt.Sprintf("%s %3d %-7s ", timestamp, status, method)
	suffix := fmt.Sprintf(" -> %s", client)
	pathWidth := width - len(prefix) - len(suffix) - 4
	if pathWidth < 10 {
		pathWidth = 10
	}
	path = truncate(path, pathWidth)

	return prefix + path + suffix
}

func parseTimestamp(raw string) (time.Time, bool) {
	if raw == "" {
		return time.Time{}, false
	}

	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, raw); err == nil {
			return t, true
		}
	}

	return time.Time{}, false
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func truncate(s string, maxLen int) string {
	if maxLen <= 3 {
		return "..."
	}
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
