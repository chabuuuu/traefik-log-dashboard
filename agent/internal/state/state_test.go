package state

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/config"
)

// newTestConfig returns a Config with PositionFile set to a temp path inside
// dir.  Passing an empty string for dir disables the position file.
func newTestConfig(t *testing.T, dir string) *config.Config {
	t.Helper()
	cfg := &config.Config{}
	if dir != "" {
		cfg.PositionFile = filepath.Join(dir, "positions.json")
	}
	return cfg
}

func TestNewStateManager_NoPositionFile(t *testing.T) {
	// When PositionFile is empty, NewStateManager must succeed without error
	// and return a usable manager with an empty position map.
	cfg := newTestConfig(t, "")
	sm := NewStateManager(cfg)

	if sm == nil {
		t.Fatal("expected non-nil StateManager")
	}

	// No positions should be present for an unknown path.
	if pos := sm.GetFilePosition("/some/log"); pos != -1 {
		t.Errorf("GetFilePosition on empty manager = %d, want -1", pos)
	}
}

func TestNewStateManager_NonExistentFile(t *testing.T) {
	// When the position file path is set but the file does not exist yet,
	// NewStateManager must still succeed gracefully.
	dir := t.TempDir()
	cfg := newTestConfig(t, dir)

	sm := NewStateManager(cfg)
	if sm == nil {
		t.Fatal("expected non-nil StateManager")
	}

	if pos := sm.GetFilePosition("/var/log/traefik/access.log"); pos != -1 {
		t.Errorf("GetFilePosition = %d, want -1 for empty manager", pos)
	}
}

func TestGetSetFilePosition(t *testing.T) {
	// Use an empty PositionFile so the async goroutine launched by
	// SetFilePosition is a no-op (SavePositions returns immediately when
	// PositionFile is "").  This avoids a Windows file-handle race during
	// TempDir cleanup.
	cfg := newTestConfig(t, "")
	sm := NewStateManager(cfg)

	const path = "/var/log/traefik/access.log"
	const want int64 = 4096

	// SetFilePosition updates the in-memory map synchronously before
	// dispatching the background save goroutine.
	sm.SetFilePosition(path, want)

	got := sm.GetFilePosition(path)
	if got != want {
		t.Errorf("GetFilePosition(%q) = %d, want %d", path, got, want)
	}
}

func TestGetFilePosition_Unknown(t *testing.T) {
	dir := t.TempDir()
	cfg := newTestConfig(t, dir)
	sm := NewStateManager(cfg)

	if pos := sm.GetFilePosition("/no/such/file"); pos != -1 {
		t.Errorf("GetFilePosition on unknown path = %d, want -1", pos)
	}
}

func TestSaveAndLoadPositions(t *testing.T) {
	dir := t.TempDir()
	cfg := newTestConfig(t, dir)

	// Populate the first manager and save synchronously.
	sm1 := NewStateManager(cfg)
	sm1.positions["/var/log/traefik/access.log"] = 8192
	sm1.positions["/var/log/traefik/traefik.log"] = 512

	if err := sm1.SavePositions(); err != nil {
		t.Fatalf("SavePositions() error: %v", err)
	}

	// Verify the file exists and contains valid JSON before creating a new manager.
	data, err := os.ReadFile(cfg.PositionFile)
	if err != nil {
		t.Fatalf("position file not created: %v", err)
	}
	var raw map[string]int64
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("position file is not valid JSON: %v", err)
	}

	// A new manager over the same file must load the persisted positions.
	sm2 := NewStateManager(cfg)

	tests := []struct {
		path string
		want int64
	}{
		{"/var/log/traefik/access.log", 8192},
		{"/var/log/traefik/traefik.log", 512},
	}
	for _, tc := range tests {
		got := sm2.GetFilePosition(tc.path)
		if got != tc.want {
			t.Errorf("after reload: GetFilePosition(%q) = %d, want %d", tc.path, got, tc.want)
		}
	}
}

func TestSavePositions_EmptyPositionFile(t *testing.T) {
	// When PositionFile is empty, SavePositions must be a no-op (no file written,
	// no error returned).
	cfg := newTestConfig(t, "")
	sm := NewStateManager(cfg)
	sm.positions["/some/file"] = 1234

	if err := sm.SavePositions(); err != nil {
		t.Fatalf("SavePositions() with empty PositionFile returned error: %v", err)
	}
}

func TestSetFilePosition_AsyncSave(t *testing.T) {
	// SetFilePosition fires a goroutine to persist state.  After a short wait
	// the position file should reflect the written value.
	dir := t.TempDir()
	cfg := newTestConfig(t, dir)
	sm := NewStateManager(cfg)

	const path = "/var/log/traefik/access.log"
	const want int64 = 65536

	sm.SetFilePosition(path, want)

	// Poll for up to 500 ms; the goroutine typically completes in microseconds
	// on any reasonable machine, but we leave margin for CI environments.
	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) {
		if _, err := os.Stat(cfg.PositionFile); err == nil {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	data, err := os.ReadFile(cfg.PositionFile)
	if err != nil {
		t.Fatalf("position file not written after SetFilePosition: %v", err)
	}

	var positions map[string]int64
	if err := json.Unmarshal(data, &positions); err != nil {
		t.Fatalf("position file contains invalid JSON: %v", err)
	}

	got, ok := positions[path]
	if !ok {
		t.Fatalf("path %q not found in persisted positions", path)
	}
	if got != want {
		t.Errorf("persisted position = %d, want %d", got, want)
	}
}

func TestSavePositions_AtomicWrite(t *testing.T) {
	// The implementation writes to a .tmp file then renames it.  After
	// SavePositions returns, only the final file should exist (the temp file
	// must have been cleaned up by the rename).
	dir := t.TempDir()
	cfg := newTestConfig(t, dir)
	sm := NewStateManager(cfg)
	sm.positions["/var/log/traefik/access.log"] = 99

	if err := sm.SavePositions(); err != nil {
		t.Fatalf("SavePositions() error: %v", err)
	}

	tmpFile := cfg.PositionFile + ".tmp"
	if _, err := os.Stat(tmpFile); !os.IsNotExist(err) {
		t.Errorf("temp file %q still exists after SavePositions", tmpFile)
	}

	if _, err := os.Stat(cfg.PositionFile); err != nil {
		t.Errorf("position file %q does not exist after SavePositions: %v", cfg.PositionFile, err)
	}
}
