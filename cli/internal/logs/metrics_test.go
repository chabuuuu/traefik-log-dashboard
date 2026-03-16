package logs

import (
	"testing"
	"time"
)

// TestCalculateMetrics_Empty verifies that an empty log slice returns a
// zero-value Metrics struct rather than panicking or returning nil.
func TestCalculateMetrics_Empty(t *testing.T) {
	m := CalculateMetrics(nil)
	if m == nil {
		t.Fatal("expected non-nil Metrics for empty input")
	}

	if m.TotalRequests != 0 {
		t.Errorf("TotalRequests: got %d, want 0", m.TotalRequests)
	}
	if m.RequestsPerSec != 0 {
		t.Errorf("RequestsPerSec: got %f, want 0", m.RequestsPerSec)
	}
	if m.AvgResponseTime != 0 {
		t.Errorf("AvgResponseTime: got %f, want 0", m.AvgResponseTime)
	}
	if m.ErrorRate != 0 {
		t.Errorf("ErrorRate: got %f, want 0", m.ErrorRate)
	}
}

// TestCalculateMetrics_StatusDistribution checks that status codes are bucketed
// into the correct 2xx / 3xx / 4xx / 5xx counters.
func TestCalculateMetrics_StatusDistribution(t *testing.T) {
	logs := []TraefikLog{
		{DownstreamStatus: 200},
		{DownstreamStatus: 201},
		{DownstreamStatus: 301},
		{DownstreamStatus: 304},
		{DownstreamStatus: 404},
		{DownstreamStatus: 422},
		{DownstreamStatus: 500},
		{DownstreamStatus: 503},
	}

	m := CalculateMetrics(logs)

	tests := []struct {
		name string
		got  int
		want int
	}{
		{"Status2xx", m.Status2xx, 2},
		{"Status3xx", m.Status3xx, 2},
		{"Status4xx", m.Status4xx, 2},
		{"Status5xx", m.Status5xx, 2},
		{"TotalRequests", m.TotalRequests, 8},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if tc.got != tc.want {
				t.Errorf("%s: got %d, want %d", tc.name, tc.got, tc.want)
			}
		})
	}

	// ErrorRate = (4xx + 5xx) / total * 100 = 4/8 * 100 = 50
	wantErrorRate := 50.0
	if m.ErrorRate != wantErrorRate {
		t.Errorf("ErrorRate: got %f, want %f", m.ErrorRate, wantErrorRate)
	}
}

// TestCalculateMetrics_RequestsPerSec verifies the RPS calculation using
// logs that span a known time window.
func TestCalculateMetrics_RequestsPerSec(t *testing.T) {
	// Build 10 logs spread across exactly 9 seconds (t0 … t0+9s).
	base := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)
	entries := make([]TraefikLog, 10)
	for i := range entries {
		entries[i] = TraefikLog{
			DownstreamStatus: 200,
			StartUTC:         base.Add(time.Duration(i) * time.Second).Format(time.RFC3339),
		}
	}

	m := CalculateMetrics(entries)

	// Expect: 10 logs / 9 seconds ≈ 1.111…
	want := float64(10) / 9.0
	const epsilon = 1e-9
	if diff := m.RequestsPerSec - want; diff > epsilon || diff < -epsilon {
		t.Errorf("RequestsPerSec: got %f, want %f", m.RequestsPerSec, want)
	}
}

// TestCalculateMetrics_RequestsPerSec_InvalidTimestamp verifies that logs
// with unparseable StartUTC fields leave RequestsPerSec at zero rather than
// producing a panic or a nonsensical value.
func TestCalculateMetrics_RequestsPerSec_InvalidTimestamp(t *testing.T) {
	entries := []TraefikLog{
		{DownstreamStatus: 200, StartUTC: "not-a-timestamp"},
		{DownstreamStatus: 200, StartUTC: "also-not-a-timestamp"},
	}

	m := CalculateMetrics(entries)

	if m.RequestsPerSec != 0 {
		t.Errorf("RequestsPerSec: got %f, want 0 for invalid timestamps", m.RequestsPerSec)
	}
}

// TestParseTimestamp verifies that all supported formats are parsed correctly
// and that an unrecognised string returns the zero time.
func TestParseTimestamp(t *testing.T) {
	ref := time.Date(2024, 6, 15, 10, 30, 0, 0, time.UTC)

	tests := []struct {
		name    string
		input   string
		wantErr bool // true if we expect zero time
	}{
		{
			name:  "RFC3339",
			input: ref.Format(time.RFC3339),
		},
		{
			name:  "RFC3339Nano",
			input: ref.Format(time.RFC3339Nano),
		},
		{
			name:  "TraefikUTC",
			input: "2024-06-15T10:30:00Z",
		},
		{
			name:    "Invalid",
			input:   "not-a-date",
			wantErr: true,
		},
		{
			name:    "Empty",
			input:   "",
			wantErr: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := parseTimestamp(tc.input)
			if tc.wantErr {
				if !got.IsZero() {
					t.Errorf("parseTimestamp(%q): expected zero time, got %v", tc.input, got)
				}
				return
			}
			if got.IsZero() {
				t.Errorf("parseTimestamp(%q): expected non-zero time, got zero", tc.input)
			}
		})
	}
}
