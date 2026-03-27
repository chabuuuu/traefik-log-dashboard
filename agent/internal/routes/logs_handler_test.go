package routes

import (
	"context"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/config"
	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/state"
)

func TestHandleStreamAccessLogs(t *testing.T) {
	dir := t.TempDir()
	logPath := filepath.Join(dir, "access.log")
	// Write valid JSON log lines so the agent parser can produce structured output
	logContent := `{"ClientAddr":"1.1.1.1:1234","ClientHost":"1.1.1.1","RequestMethod":"GET","RequestPath":"/first","RequestHost":"example.com","StartUTC":"2024-01-01T00:00:00Z","DownstreamStatus":200,"RequestCount":1}
{"ClientAddr":"2.2.2.2:1234","ClientHost":"2.2.2.2","RequestMethod":"POST","RequestPath":"/second","RequestHost":"example.com","StartUTC":"2024-01-01T00:00:01Z","DownstreamStatus":302,"RequestCount":1}
`
	if err := os.WriteFile(logPath, []byte(logContent), 0644); err != nil {
		t.Fatalf("write log: %v", err)
	}

	cfg := &config.Config{
		AccessPath:             logPath,
		StreamBatchLines:       10,
		StreamFlushIntervalMS:  10,
		StreamMaxClients:       5,
		StreamMaxDurationSec:   1,
		StreamMaxBytesPerBatch: 4096,
	}

	st := state.NewStateManager(cfg)
	h := NewHandler(cfg, st)

	req := httptest.NewRequest("GET", "/api/logs/stream", nil)
	// Cancel after a short time to end the loop
	cancelTime, cancel := context.WithTimeout(req.Context(), 50*time.Millisecond)
	defer cancel()
	req = req.WithContext(cancelTime)

	rr := httptest.NewRecorder()
	h.HandleStreamAccessLogs(rr, req)

	body := rr.Body.String()
	// SSE data lines should contain JSON objects with structured fields
	if !strings.Contains(body, "event: log") {
		t.Fatalf("expected stream to emit typed log events, got: %s", body)
	}
	if !strings.Contains(body, "event: cursor") {
		t.Fatalf("expected stream to emit cursor checkpoints, got: %s", body)
	}
	if !strings.Contains(body, `"ClientHost"`) {
		t.Fatalf("expected stream to contain structured JSON with ClientHost, got: %s", body)
	}
	if !strings.Contains(body, `"/first"`) {
		t.Fatalf("expected stream to contain /first path, got: %s", body)
	}
}
