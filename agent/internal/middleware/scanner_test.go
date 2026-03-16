package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// passthroughHandler records that it was called so tests can assert that clean
// requests do reach the inner handler.
func passthroughHandler(called *bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		*called = true
		w.WriteHeader(http.StatusOK)
	})
}

// assertBlocked checks that the response carries a 400 Bad Request status and
// the expected JSON error body.
func assertBlocked(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d (body: %s)", http.StatusBadRequest, rec.Code, rec.Body.String())
		return
	}

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("response body is not valid JSON: %v", err)
	}
	if body["error"] != "malicious pattern detected" {
		t.Errorf("body[\"error\"] = %q, want %q", body["error"], "malicious pattern detected")
	}
}

// newScannerRequest builds a request whose URL.Path is path and whose
// URL.RawQuery is rawQuery.  RawQuery is assigned directly after construction
// so that literal characters (spaces, angle brackets) that are meaningful to
// the scanner regex are preserved exactly as-is without URL-encoding.
//
// Background: the scanner inspects r.URL.Path + "?" + r.URL.RawQuery, so the
// patterns we need to trigger must appear in those fields verbatim.
// httptest.NewRequest percent-encodes many characters in the target string,
// which would prevent the regexes from matching.  Setting RawQuery directly
// after construction bypasses that encoding.
//
// tb may be nil (e.g. when called from a benchmark using a plain "/safe" path).
func newScannerRequest(tb testing.TB, path, rawQuery string) *http.Request {
	if tb != nil {
		tb.Helper()
	}
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.URL.RawQuery = rawQuery
	return req
}

// ---------------------------------------------------------------------------
// SQL injection
// ---------------------------------------------------------------------------

func TestMaliciousPatternScanner_SQLInjection(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		rawQuery string
	}{
		{
			name:     "union select in query",
			path:     "/search",
			rawQuery: "q=union select 1",
		},
		{
			name:     "UNION SELECT uppercase",
			path:     "/search",
			rawQuery: "q=UNION SELECT username,password FROM users",
		},
		{
			name:     "drop table in query",
			path:     "/admin",
			rawQuery: "cmd=drop table users",
		},
		{
			name:     "DROP TABLE uppercase",
			path:     "/",
			rawQuery: "x=DROP TABLE sessions",
		},
		{
			name:     "insert into",
			path:     "/",
			rawQuery: "q=insert into users values",
		},
		{
			name:     "delete from",
			path:     "/",
			rawQuery: "q=delete from orders",
		},
		{
			name:     "update set",
			path:     "/",
			rawQuery: "q=update users set password=hacked",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			called := false
			handler := MaliciousPatternScanner()(passthroughHandler(&called))

			req := newScannerRequest(t, tc.path, tc.rawQuery)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			assertBlocked(t, rec)
			if called {
				t.Error("inner handler must not be called for SQL injection attempts")
			}
		})
	}
}

// ---------------------------------------------------------------------------
// XSS
// ---------------------------------------------------------------------------

func TestMaliciousPatternScanner_XSS(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		rawQuery string
	}{
		{
			// <script in the query — set RawQuery directly so angle brackets
			// are not percent-encoded and the regex sees them as-is.
			name:     "script tag in query",
			path:     "/search",
			rawQuery: "q=<script>alert(1)</script>",
		},
		{
			name:     "SCRIPT tag uppercase",
			path:     "/",
			rawQuery: "x=<SCRIPT>evil()</SCRIPT>",
		},
		{
			name:     "javascript: scheme",
			path:     "/",
			rawQuery: "url=javascript:alert(document.cookie)",
		},
		{
			// on\w+\s*= pattern — "onerror =" with a space before the equals.
			name:     "onerror attribute",
			path:     "/",
			rawQuery: "img=onerror =alert(1)",
		},
		{
			name:     "onclick attribute",
			path:     "/",
			rawQuery: "x=onclick =doEvil()",
		},
		{
			// Decoded path — Go's HTTP server normally normalises paths, but
			// when we construct the request manually the raw path can contain
			// decoded angle brackets that the scanner will see in r.URL.Path.
			name:     "script tag in path",
			path:     "/<script>xss</script>",
			rawQuery: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			called := false
			handler := MaliciousPatternScanner()(passthroughHandler(&called))

			var req *http.Request
			if tc.rawQuery != "" || tc.path == "/" {
				req = newScannerRequest(t, tc.path, tc.rawQuery)
			} else {
				// Path contains characters invalid for httptest.NewRequest
				// (angle brackets). Build the request against "/" and override
				// URL.Path directly so the scanner sees the raw value.
				req = httptest.NewRequest(http.MethodGet, "/", nil)
				req.URL.Path = tc.path
				req.URL.RawQuery = tc.rawQuery
			}

			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			assertBlocked(t, rec)
			if called {
				t.Error("inner handler must not be called for XSS attempts")
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Path traversal
// ---------------------------------------------------------------------------

func TestMaliciousPatternScanner_PathTraversal(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		rawQuery string
	}{
		{
			name:     "dot-dot-slash in path",
			path:     "/files/../etc/passwd",
			rawQuery: "",
		},
		{
			name:     "dot-dot-slash in query",
			path:     "/download",
			rawQuery: "file=../../etc/shadow",
		},
		{
			name:     "multiple traversal segments",
			path:     "/static/../../../proc/self/environ",
			rawQuery: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			called := false
			handler := MaliciousPatternScanner()(passthroughHandler(&called))

			req := newScannerRequest(t, tc.path, tc.rawQuery)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			assertBlocked(t, rec)
			if called {
				t.Error("inner handler must not be called for path traversal attempts")
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Clean requests
// ---------------------------------------------------------------------------

func TestMaliciousPatternScanner_CleanRequest(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		rawQuery string
	}{
		{
			name: "root path no query",
			path: "/",
		},
		{
			name:     "normal API path with safe query",
			path:     "/api/v1/logs",
			rawQuery: "limit=100&offset=0",
		},
		{
			// The word "select" alone must not trigger SQL injection detection.
			name:     "path with harmless select word",
			path:     "/select-plan",
			rawQuery: "tier=pro",
		},
		{
			name:     "search with regular keyword",
			path:     "/search",
			rawQuery: "q=traefik+dashboard",
		},
		{
			name: "health endpoint",
			path: "/health",
		},
		{
			name:     "pagination query",
			path:     "/logs",
			rawQuery: "page=2&per_page=50",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			called := false
			handler := MaliciousPatternScanner()(passthroughHandler(&called))

			req := newScannerRequest(t, tc.path, tc.rawQuery)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Errorf("expected %d for clean request, got %d (body: %s)",
					http.StatusOK, rec.Code, rec.Body.String())
			}
			if !called {
				t.Error("inner handler must be called for clean requests")
			}
		})
	}
}

func TestMaliciousPatternScanner_ContentTypeOnBlock(t *testing.T) {
	// The scanner must set Content-Type: application/json on all blocked
	// responses so clients can reliably decode the error body.
	called := false
	handler := MaliciousPatternScanner()(passthroughHandler(&called))

	req := newScannerRequest(t, "/", "q=<script>alert(1)</script>")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
	ct := rec.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("Content-Type = %q, want %q", ct, "application/json")
	}
}

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

func BenchmarkMaliciousPatternScanner_CleanPath(b *testing.B) {
	handler := MaliciousPatternScanner()(noopHandler)
	req := newScannerRequest(b, "/api/v1/logs", "limit=100")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
	}
}

func BenchmarkMaliciousPatternScanner_BlockedPath(b *testing.B) {
	handler := MaliciousPatternScanner()(noopHandler)
	req := newScannerRequest(b, "/search", "q=union select 1")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
	}
}
