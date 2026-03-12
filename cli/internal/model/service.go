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
func (s *LogService) FetchErrorLogs(maxLogs int) ([]logs.TraefikLog, error) {
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
		errorLogs = []logs.TraefikLog{}
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
	ErrorLogs   []logs.TraefikLog
	Metrics     *logs.Metrics
	SystemStats *logs.SystemStats
}

// generateDemoErrorLogs generates demo error logs
func generateDemoErrorLogs(count int) []logs.TraefikLog {
	if count <= 0 {
		return []logs.TraefikLog{}
	}

	demoLogs := logs.GenerateDemoLogs(count)
	for i := range demoLogs {
		switch i % 4 {
		case 0:
			demoLogs[i].DownstreamStatus = 500
		case 1:
			demoLogs[i].DownstreamStatus = 502
		case 2:
			demoLogs[i].DownstreamStatus = 503
		default:
			demoLogs[i].DownstreamStatus = 404
		}
	}

	return demoLogs
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
