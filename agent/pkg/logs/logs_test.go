package logs

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func writeTempLog(t *testing.T, lines []string) (string, func()) {
	t.Helper()
	dir := t.TempDir()
	fp := filepath.Join(dir, "access.log")
	content := ""
	for _, l := range lines {
		content += l + "\n"
	}
	if err := os.WriteFile(fp, []byte(content), 0644); err != nil {
		t.Fatalf("write file: %v", err)
	}
	return fp, func() { os.Remove(fp) }
}

// Valid JSON log lines for testing
var testLogLines = []string{
	`{"ClientAddr":"1.1.1.1:1234","ClientHost":"1.1.1.1","RequestMethod":"GET","RequestPath":"/","RequestHost":"example.com","StartUTC":"2024-01-01T00:00:00Z","DownstreamStatus":200,"RequestCount":1}`,
	`{"ClientAddr":"2.2.2.2:1234","ClientHost":"2.2.2.2","RequestMethod":"POST","RequestPath":"/login","RequestHost":"example.com","StartUTC":"2024-01-01T00:00:01Z","DownstreamStatus":302,"RequestCount":1}`,
	`{"ClientAddr":"3.3.3.3:1234","ClientHost":"3.3.3.3","RequestMethod":"GET","RequestPath":"/api","RequestHost":"example.com","StartUTC":"2024-01-01T00:00:02Z","DownstreamStatus":200,"RequestCount":1}`,
}

func TestStreamFromPositionReadsNewLines(t *testing.T) {
	fp, cleanup := writeTempLog(t, testLogLines[:3])
	defer cleanup()

	ctx := context.Background()
	logs, pos, err := StreamFromPosition(ctx, fp, 0, 10, 4096)
	if err != nil {
		t.Fatalf("stream error: %v", err)
	}
	if len(logs) != 3 {
		t.Fatalf("expected 3 logs, got %d", len(logs))
	}
	if pos == 0 {
		t.Fatalf("position did not advance")
	}
	// Verify parsed fields
	if logs[0].ClientHost != "1.1.1.1" {
		t.Fatalf("expected ClientHost 1.1.1.1, got %s", logs[0].ClientHost)
	}

	// Append new lines and read from last position
	f, _ := os.OpenFile(fp, os.O_APPEND|os.O_WRONLY, 0644)
	f.WriteString(`{"ClientAddr":"4.4.4.4:1234","ClientHost":"4.4.4.4","RequestMethod":"GET","RequestPath":"/new","RequestHost":"example.com","StartUTC":"2024-01-01T00:00:03Z","DownstreamStatus":200,"RequestCount":1}` + "\n")
	f.WriteString(`{"ClientAddr":"5.5.5.5:1234","ClientHost":"5.5.5.5","RequestMethod":"GET","RequestPath":"/new2","RequestHost":"example.com","StartUTC":"2024-01-01T00:00:04Z","DownstreamStatus":200,"RequestCount":1}` + "\n")
	f.Close()

	logs2, pos2, err := StreamFromPosition(ctx, fp, pos, 10, 4096)
	if err != nil {
		t.Fatalf("stream error 2: %v", err)
	}
	if len(logs2) != 2 {
		t.Fatalf("expected 2 new logs, got %d", len(logs2))
	}
	if pos2 <= pos {
		t.Fatalf("position did not move forward")
	}
}

func TestStreamFromPositionMaxBytes(t *testing.T) {
	fp, cleanup := writeTempLog(t, testLogLines[:3])
	defer cleanup()

	ctx := context.Background()
	// Use a small maxBytes to trigger truncation — enough for ~1 JSON log line
	logs, _, err := StreamFromPosition(ctx, fp, 0, 10, 250)
	if err != nil {
		t.Fatalf("stream error: %v", err)
	}
	if len(logs) == 0 {
		t.Fatalf("expected at least one log under byte cap")
	}
	if len(logs) >= 3 {
		t.Fatalf("expected fewer than 3 logs due to byte cap, got %d", len(logs))
	}
}

func BenchmarkParseTraefikLogs(b *testing.B) {
	lines := []string{
		`{"ClientAddr":"1.1.1.1:1234","RequestMethod":"GET","RequestPath":"/","RequestHost":"example.com","StartUTC":"2024-01-01T00:00:00Z","DownstreamStatus":200,"RequestCount":1}`,
		`{"ClientAddr":"2.2.2.2:1234","RequestMethod":"POST","RequestPath":"/login","RequestHost":"example.com","StartUTC":"2024-01-01T00:00:01Z","DownstreamStatus":302,"RequestCount":1}`,
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = ParseTraefikLogs(lines)
	}
}

func BenchmarkStreamFromPosition(b *testing.B) {
	// Prepare a file with many valid JSON log lines
	lines := make([]string, 0, 1000)
	for i := 0; i < 1000; i++ {
		lines = append(lines, `{"ClientAddr":"1.1.1.1:1234","RequestMethod":"GET","RequestPath":"/","RequestHost":"example.com","StartUTC":"2024-01-01T00:00:00Z","DownstreamStatus":200,"RequestCount":1}`)
	}
	fp, cleanup := writeTempLog(&testing.T{}, lines)
	defer cleanup()

	ctx := context.Background()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _, err := StreamFromPosition(ctx, fp, 0, 400, 512*1024)
		if err != nil {
			b.Fatalf("stream error: %v", err)
		}
	}
}
