package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
)

// noopHandler is a trivial handler used to confirm a request passed the
// rate-limit middleware successfully.
var noopHandler = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
})

// uniqueIP generates a routable IP address that is unique per test, preventing
// the package-level sync.Map from carrying state between test functions.
func uniqueIP(t *testing.T, suffix int) string {
	t.Helper()
	// Use 203.0.113.0/24 (TEST-NET-3, RFC 5737) so addresses are clearly
	// test-only and never appear in real traffic.
	return fmt.Sprintf("203.0.113.%d", suffix)
}

func TestRateLimit_Disabled(t *testing.T) {
	// requestsPerMinute <= 0 must disable rate limiting; all requests pass.
	for _, rpm := range []int{0, -1, -100} {
		t.Run(fmt.Sprintf("rpm=%d", rpm), func(t *testing.T) {
			handler := RateLimit(rpm)(noopHandler)

			for i := 0; i < 20; i++ {
				req := httptest.NewRequest(http.MethodGet, "/", nil)
				req.RemoteAddr = "198.51.100.1:1234" // TEST-NET-2
				rec := httptest.NewRecorder()
				handler.ServeHTTP(rec, req)

				if rec.Code != http.StatusOK {
					t.Fatalf("rpm=%d request %d: expected %d, got %d", rpm, i, http.StatusOK, rec.Code)
				}
			}
		})
	}
}

func TestRateLimit_AllowsUnderLimit(t *testing.T) {
	const limit = 10
	// Use a dedicated IP to avoid state from other tests.
	ip := uniqueIP(t, 10)

	handler := RateLimit(limit)(noopHandler)

	// Send exactly limit requests; all must succeed.
	for i := 0; i < limit; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = ip + ":9000"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("request %d/%d: expected %d, got %d", i+1, limit, http.StatusOK, rec.Code)
		}
	}
}

func TestRateLimit_BlocksOverLimit(t *testing.T) {
	const limit = 5
	ip := uniqueIP(t, 20)

	handler := RateLimit(limit)(noopHandler)

	// Exhaust the limit.
	for i := 0; i < limit; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = ip + ":9000"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("request %d should be allowed, got %d", i+1, rec.Code)
		}
	}

	// The next request must be blocked with 429.
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = ip + ":9000"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected %d after limit, got %d", http.StatusTooManyRequests, rec.Code)
	}
}

func TestRateLimit_RetryAfterHeader(t *testing.T) {
	const limit = 3
	ip := uniqueIP(t, 30)

	handler := RateLimit(limit)(noopHandler)

	// Exhaust the limit.
	for i := 0; i < limit; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = ip + ":9000"
		handler.ServeHTTP(httptest.NewRecorder(), req)
	}

	// Trigger a 429.
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = ip + ":9000"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", rec.Code)
	}

	retryAfter := rec.Header().Get("Retry-After")
	if retryAfter == "" {
		t.Fatal("Retry-After header missing on 429 response")
	}

	seconds, err := strconv.Atoi(retryAfter)
	if err != nil {
		t.Fatalf("Retry-After header %q is not an integer: %v", retryAfter, err)
	}
	// The value must be positive (the window is 60 seconds).
	if seconds <= 0 {
		t.Errorf("Retry-After = %d, want > 0", seconds)
	}
}

func TestRateLimit_ResponseBodyOnBlock(t *testing.T) {
	const limit = 2
	ip := uniqueIP(t, 40)

	handler := RateLimit(limit)(noopHandler)

	for i := 0; i < limit; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = ip + ":9000"
		handler.ServeHTTP(httptest.NewRecorder(), req)
	}

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = ip + ":9000"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", rec.Code)
	}

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("response body is not valid JSON: %v", err)
	}
	if body["error"] != "rate limit exceeded" {
		t.Errorf("body[\"error\"] = %q, want %q", body["error"], "rate limit exceeded")
	}
}

func TestRateLimit_DifferentIPsAreIndependent(t *testing.T) {
	const limit = 3
	ipA := uniqueIP(t, 50)
	ipB := uniqueIP(t, 51)

	handler := RateLimit(limit)(noopHandler)

	// Exhaust limit for ipA only.
	for i := 0; i < limit; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = ipA + ":9000"
		handler.ServeHTTP(httptest.NewRecorder(), req)
	}

	// ipA should now be blocked.
	reqA := httptest.NewRequest(http.MethodGet, "/", nil)
	reqA.RemoteAddr = ipA + ":9000"
	recA := httptest.NewRecorder()
	handler.ServeHTTP(recA, reqA)
	if recA.Code != http.StatusTooManyRequests {
		t.Errorf("ipA: expected 429, got %d", recA.Code)
	}

	// ipB must not be affected by ipA's rate limit.
	reqB := httptest.NewRequest(http.MethodGet, "/", nil)
	reqB.RemoteAddr = ipB + ":9000"
	recB := httptest.NewRecorder()
	handler.ServeHTTP(recB, reqB)
	if recB.Code != http.StatusOK {
		t.Errorf("ipB: expected %d (independent of ipA), got %d", http.StatusOK, recB.Code)
	}
}

// ---------------------------------------------------------------------------
// extractIP tests
// ---------------------------------------------------------------------------

func TestExtractIP_XForwardedFor(t *testing.T) {
	tests := []struct {
		name   string
		xff    string
		want   string
	}{
		{
			name: "single IP",
			xff:  "192.0.2.1",
			want: "192.0.2.1",
		},
		{
			name: "comma-separated list uses first entry",
			xff:  "192.0.2.1, 10.0.0.1, 172.16.0.5",
			want: "192.0.2.1",
		},
		{
			name: "two IPs no spaces",
			xff:  "198.51.100.7,10.1.2.3",
			want: "198.51.100.7",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.Header.Set("X-Forwarded-For", tc.xff)

			got := extractIP(req)
			if got != tc.want {
				t.Errorf("extractIP with XFF %q = %q, want %q", tc.xff, got, tc.want)
			}
		})
	}
}

func TestExtractIP_RemoteAddr(t *testing.T) {
	tests := []struct {
		name       string
		remoteAddr string
		want       string
	}{
		{
			name:       "host:port format",
			remoteAddr: "203.0.113.42:12345",
			want:       "203.0.113.42",
		},
		{
			name:       "IPv6 with port",
			remoteAddr: "[::1]:8080",
			want:       "::1",
		},
		{
			name:       "bare address without port falls back to raw value",
			remoteAddr: "203.0.113.99",
			want:       "203.0.113.99",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			// Ensure no XFF header is present so RemoteAddr is used.
			req.Header.Del("X-Forwarded-For")
			req.RemoteAddr = tc.remoteAddr

			got := extractIP(req)
			if got != tc.want {
				t.Errorf("extractIP with RemoteAddr %q = %q, want %q", tc.remoteAddr, got, tc.want)
			}
		})
	}
}

func TestExtractIP_XForwardedForPreferredOverRemoteAddr(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "10.0.0.1:9000"
	req.Header.Set("X-Forwarded-For", "203.0.113.5")

	got := extractIP(req)
	if got != "203.0.113.5" {
		t.Errorf("expected XFF IP %q, got %q", "203.0.113.5", got)
	}
}

// ---------------------------------------------------------------------------
// Benchmark
// ---------------------------------------------------------------------------

func BenchmarkRateLimit_UnderLimit(b *testing.B) {
	// Use a limit high enough that we never trigger the 429 path.
	handler := RateLimit(1_000_000)(noopHandler)
	req := httptest.NewRequest(http.MethodGet, "/bench", nil)
	req.RemoteAddr = "198.51.100.200:5000"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
	}
}
