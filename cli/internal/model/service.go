package model

import (
	"context"
	"fmt"

	"github.com/hhftechnology/traefik-log-dashboard/cli/internal/logs"
)

// LogService handles log fetching and processing
type LogService struct {
	agentURL  string
	authToken string
	demoMode  bool
}

// NewLogService creates a new LogService
func NewLogService(agentURL, authToken string, demoMode bool) *LogService {
	return &LogService{
		agentURL:  agentURL,
		authToken: authToken,
		demoMode:  demoMode,
	}
}

// FetchAccessLogs fetches access logs from agent or generates demo data
func (s *LogService) FetchAccessLogs(maxLogs int) ([]logs.TraefikLog, error) {
	if s.demoMode {
		return logs.GenerateDemoLogs(maxLogs), nil
	}

	accessLogs, err := logs.FetchAccessLogs(context.Background(), s.agentURL, s.authToken, maxLogs)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch access logs: %w", err)
	}

	return accessLogs, nil
}

// FetchErrorLogs fetches error logs from agent or generates demo data
func (s *LogService) FetchErrorLogs(maxLogs int) ([]string, error) {
	if s.demoMode {
		return generateDemoErrorLogs(maxLogs), nil
	}

	errorLogs, err := logs.FetchErrorLogs(context.Background(), s.agentURL, s.authToken, maxLogs)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch error logs: %w", err)
	}

	return errorLogs, nil
}

// FetchSystemStats fetches system statistics from agent
func (s *LogService) FetchSystemStats() (*logs.SystemStats, error) {
	if s.demoMode {
		return generateDemoSystemStats(), nil
	}

	stats, err := logs.FetchSystemStats(context.Background(), s.agentURL, s.authToken)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch system stats: %w", err)
	}

	return stats, nil
}

// FetchAllData fetches all data (access logs, error logs, system stats)
func (s *LogService) FetchAllData(maxAccessLogs, maxErrorLogs int) (*AllData, error) {
	accessLogs, err := s.FetchAccessLogs(maxAccessLogs)
	if err != nil {
		return nil, err
	}

	errorLogs, err := s.FetchErrorLogs(maxErrorLogs)
	if err != nil {
		// Don't fail if error logs can't be fetched
		errorLogs = []string{}
	}

	var systemStats *logs.SystemStats
	systemStats, err = s.FetchSystemStats()
	if err != nil {
		// Don't fail if system stats can't be fetched
		systemStats = nil
	}

	metrics := logs.CalculateMetrics(accessLogs)

	return &AllData{
		AccessLogs:  accessLogs,
		ErrorLogs:   errorLogs,
		Metrics:     metrics,
		SystemStats: systemStats,
	}, nil
}

// AllData holds all fetched data
type AllData struct {
	AccessLogs  []logs.TraefikLog
	ErrorLogs   []string
	Metrics     *logs.Metrics
	SystemStats *logs.SystemStats
}

// generateDemoErrorLogs generates demo error logs
func generateDemoErrorLogs(count int) []string {
	demoErrors := []string{
		"2025-10-03T10:30:00Z ERROR Unable to reach backend service",
		"2025-10-03T10:29:45Z WARN Slow response from upstream: 2500ms",
		"2025-10-03T10:29:30Z ERROR Connection timeout to backend-service",
		"2025-10-03T10:29:15Z WARN Rate limit exceeded for client 192.168.1.100",
		"2025-10-03T10:29:00Z ERROR Certificate validation failed",
		"2025-10-03T10:28:45Z INFO Router configuration reloaded",
		"2025-10-03T10:28:30Z ERROR Database connection pool exhausted",
		"2025-10-03T10:28:15Z WARN High memory usage detected: 85%",
		"2025-10-03T10:28:00Z ERROR Failed to authenticate request",
		"2025-10-03T10:27:45Z WARN Middleware timeout: custom-auth-middleware",
	}

	result := make([]string, 0, count)
	for i := 0; i < count; i++ {
		result = append(result, demoErrors[i%len(demoErrors)])
	}

	return result
}

// generateDemoSystemStats generates demo system statistics
func generateDemoSystemStats() *logs.SystemStats {
	return &logs.SystemStats{
		CPU: logs.CPUStats{
			UsagePercent: 45.5,
			Cores:        8,
		},
		Memory: logs.MemoryStats{
			Total:       16_000_000_000,
			Available:   8_000_000_000,
			Used:        8_000_000_000,
			UsedPercent: 50.0,
			Free:        8_000_000_000,
		},
		Disk: logs.DiskStats{
			Total:       500_000_000_000,
			Used:        300_000_000_000,
			Free:        200_000_000_000,
			UsedPercent: 60.0,
		},
	}
}