package logs

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// accessResponse is the JSON envelope the agent returns for the access-logs
// endpoint.
type accessResponse struct {
	Logs []TraefikLog `json:"logs"`
}

// errorResponse is the JSON envelope for the error-logs endpoint.
type errorResponse struct {
	Logs []TraefikLog `json:"logs"`
}

// mustMarshal marshals v to JSON or fails the test immediately.
func mustMarshal(t *testing.T, v interface{}) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("json.Marshal: %v", err)
	}
	return b
}

// --- FetchAccessLogs tests ---

// TestFetchAccessLogs_Success verifies that a valid agent response is decoded
// into the expected slice of TraefikLog entries.
func TestFetchAccessLogs_Success(t *testing.T) {
	wantLog := TraefikLog{
		RequestMethod:    "GET",
		RequestPath:      "/api/health",
		DownstreamStatus: 200,
		ServiceName:      "backend",
		StartUTC:         "2024-01-01T10:00:00Z",
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := accessResponse{Logs: []TraefikLog{wantLog}}
		w.Header().Set("Content-Type", "application/json")
		if _, err := w.Write(mustMarshal(t, resp)); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	defer srv.Close()

	got, err := FetchAccessLogs(context.Background(), srv.URL, "", 100)
	if err != nil {
		t.Fatalf("FetchAccessLogs: unexpected error: %v", err)
	}

	if len(got) != 1 {
		t.Fatalf("got %d logs, want 1", len(got))
	}

	g := got[0]
	if g.RequestMethod != wantLog.RequestMethod {
		t.Errorf("RequestMethod: got %q, want %q", g.RequestMethod, wantLog.RequestMethod)
	}
	if g.RequestPath != wantLog.RequestPath {
		t.Errorf("RequestPath: got %q, want %q", g.RequestPath, wantLog.RequestPath)
	}
	if g.DownstreamStatus != wantLog.DownstreamStatus {
		t.Errorf("DownstreamStatus: got %d, want %d", g.DownstreamStatus, wantLog.DownstreamStatus)
	}
	if g.ServiceName != wantLog.ServiceName {
		t.Errorf("ServiceName: got %q, want %q", g.ServiceName, wantLog.ServiceName)
	}
}

// TestFetchAccessLogs_AuthHeader verifies that the Bearer token is included in
// the Authorization header sent to the agent.
func TestFetchAccessLogs_AuthHeader(t *testing.T) {
	const token = "supersecret"
	var gotHeader string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHeader = r.Header.Get("Authorization")
		resp := accessResponse{Logs: []TraefikLog{}}
		w.Header().Set("Content-Type", "application/json")
		if _, err := w.Write(mustMarshal(t, resp)); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	defer srv.Close()

	if _, err := FetchAccessLogs(context.Background(), srv.URL, token, 10); err != nil {
		t.Fatalf("FetchAccessLogs: unexpected error: %v", err)
	}

	want := "Bearer " + token
	if gotHeader != want {
		t.Errorf("Authorization header: got %q, want %q", gotHeader, want)
	}
}

// TestFetchAccessLogs_NoAuthHeader verifies that no Authorization header is
// sent when the token is empty.
func TestFetchAccessLogs_NoAuthHeader(t *testing.T) {
	var gotHeader string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHeader = r.Header.Get("Authorization")
		resp := accessResponse{Logs: []TraefikLog{}}
		w.Header().Set("Content-Type", "application/json")
		if _, err := w.Write(mustMarshal(t, resp)); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	defer srv.Close()

	if _, err := FetchAccessLogs(context.Background(), srv.URL, "", 10); err != nil {
		t.Fatalf("FetchAccessLogs: unexpected error: %v", err)
	}

	if gotHeader != "" {
		t.Errorf("Authorization header: got %q, want empty", gotHeader)
	}
}

// TestFetchAccessLogs_ServerError verifies that a non-200 response is surfaced
// as a non-nil error and that the error message contains the status code.
func TestFetchAccessLogs_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "internal server error", http.StatusInternalServerError)
	}))
	defer srv.Close()

	_, err := FetchAccessLogs(context.Background(), srv.URL, "", 100)
	if err == nil {
		t.Fatal("expected error for 500 response, got nil")
	}
	if !strings.Contains(err.Error(), "500") {
		t.Errorf("error %q does not mention status 500", err.Error())
	}
}

// TestFetchAccessLogs_MultipleEntries verifies that multiple entries are
// returned as-is from the endpoint payload.
func TestFetchAccessLogs_MultipleEntries(t *testing.T) {
	wantLogs := []TraefikLog{
		{RequestMethod: "POST", DownstreamStatus: 201},
		{RequestMethod: "GET", DownstreamStatus: 404},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := accessResponse{Logs: wantLogs}
		w.Header().Set("Content-Type", "application/json")
		if _, err := w.Write(mustMarshal(t, resp)); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	defer srv.Close()

	got, err := FetchAccessLogs(context.Background(), srv.URL, "", 100)
	if err != nil {
		t.Fatalf("FetchAccessLogs: unexpected error: %v", err)
	}
	if len(got) != len(wantLogs) {
		t.Errorf("got %d logs, want %d", len(got), len(wantLogs))
	}
}

// --- FetchErrorLogs tests ---

// TestFetchErrorLogs_Success verifies that structured error logs are returned.
func TestFetchErrorLogs_Success(t *testing.T) {
	wantLogs := []TraefikLog{
		{
			StartUTC:         "2024-01-01T10:00:00Z",
			RequestMethod:    "GET",
			RequestPath:      "/api/orders",
			DownstreamStatus: 500,
			ClientHost:       "10.0.0.1",
		},
		{
			StartUTC:         "2024-01-01T10:01:00Z",
			RequestMethod:    "POST",
			RequestPath:      "/api/users",
			DownstreamStatus: 502,
			ClientHost:       "10.0.0.2",
		},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := errorResponse{Logs: wantLogs}
		w.Header().Set("Content-Type", "application/json")
		if _, err := w.Write(mustMarshal(t, resp)); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	defer srv.Close()

	got, err := FetchErrorLogs(context.Background(), srv.URL, "", 100)
	if err != nil {
		t.Fatalf("FetchErrorLogs: unexpected error: %v", err)
	}
	if len(got) != len(wantLogs) {
		t.Fatalf("got %d logs, want %d", len(got), len(wantLogs))
	}
	for i := range wantLogs {
		if got[i].DownstreamStatus != wantLogs[i].DownstreamStatus {
			t.Errorf(
				"log[%d].DownstreamStatus: got %d, want %d",
				i,
				got[i].DownstreamStatus,
				wantLogs[i].DownstreamStatus,
			)
		}
		if got[i].RequestPath != wantLogs[i].RequestPath {
			t.Errorf(
				"log[%d].RequestPath: got %q, want %q",
				i,
				got[i].RequestPath,
				wantLogs[i].RequestPath,
			)
		}
	}
}

// TestFetchErrorLogs_ServerError verifies error propagation for non-200 status.
func TestFetchErrorLogs_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "not found", http.StatusNotFound)
	}))
	defer srv.Close()

	_, err := FetchErrorLogs(context.Background(), srv.URL, "", 100)
	if err == nil {
		t.Fatal("expected error for 404 response, got nil")
	}
	if !strings.Contains(err.Error(), "404") {
		t.Errorf("error %q does not mention status 404", err.Error())
	}
}

// --- FetchSystemStats tests ---

// TestFetchSystemStats_Success verifies that system stats are decoded from the
// agent response.
func TestFetchSystemStats_Success(t *testing.T) {
	wantStats := SystemStats{
		CPU:    CPUStats{UsagePercent: 42.5, Cores: 4},
		Memory: MemoryStats{Total: 8_000_000_000, UsedPercent: 60.0},
		Disk:   DiskStats{Total: 500_000_000_000, UsedPercent: 30.0},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if _, err := w.Write(mustMarshal(t, wantStats)); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	defer srv.Close()

	got, err := FetchSystemStats(context.Background(), srv.URL, "")
	if err != nil {
		t.Fatalf("FetchSystemStats: unexpected error: %v", err)
	}
	if got == nil {
		t.Fatal("expected non-nil SystemStats")
	}
	if got.CPU.UsagePercent != wantStats.CPU.UsagePercent {
		t.Errorf("CPU.UsagePercent: got %f, want %f", got.CPU.UsagePercent, wantStats.CPU.UsagePercent)
	}
	if got.CPU.Cores != wantStats.CPU.Cores {
		t.Errorf("CPU.Cores: got %d, want %d", got.CPU.Cores, wantStats.CPU.Cores)
	}
	if got.Memory.UsedPercent != wantStats.Memory.UsedPercent {
		t.Errorf("Memory.UsedPercent: got %f, want %f", got.Memory.UsedPercent, wantStats.Memory.UsedPercent)
	}
}

// TestFetchSystemStats_ServerError verifies error propagation for non-200 status.
func TestFetchSystemStats_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "service unavailable", http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	_, err := FetchSystemStats(context.Background(), srv.URL, "")
	if err == nil {
		t.Fatal("expected error for 503 response, got nil")
	}
	if !strings.Contains(err.Error(), "503") {
		t.Errorf("error %q does not mention status 503", err.Error())
	}
}

// TestFetchAccessLogs_ContextCancellation verifies that a cancelled context
// causes FetchAccessLogs to return a non-nil error promptly.
func TestFetchAccessLogs_ContextCancellation(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The server never responds; the client should time out via context.
		<-r.Context().Done()
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	_, err := FetchAccessLogs(ctx, srv.URL, "", 10)
	if err == nil {
		t.Fatal("expected error for cancelled context, got nil")
	}
}
