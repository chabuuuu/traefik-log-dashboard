package logs

import (
	"testing"
)

func TestParseTraefikLog_JSONFallbackFields(t *testing.T) {
	line := `{"time":"2025-10-25T21:11:49Z","request_X-Real-IP":"103.4.250.66","RequestPath":"/fallback"}`

	parsed, err := ParseTraefikLog(line)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if parsed == nil {
		t.Fatalf("expected parsed log, got nil")
	}

	if parsed.ClientHost != "103.4.250.66" {
		t.Fatalf("expected ClientHost fallback from request_X-Real-IP, got %q", parsed.ClientHost)
	}
	if parsed.RequestMethod != "GET" {
		t.Fatalf("expected default method GET, got %q", parsed.RequestMethod)
	}
	if parsed.RequestPath != "/fallback" {
		t.Fatalf("expected request path /fallback, got %q", parsed.RequestPath)
	}
	if parsed.StartUTC.IsZero() {
		t.Fatalf("expected StartUTC to be parsed from time field")
	}
}

func TestParseTraefikLog_TraefikCLF(t *testing.T) {
	line := `192.168.1.100 - user [15/May/2025:12:06:30 +0000] "GET /api/endpoint HTTP/1.1" 200 1024 "https://example.com" "Mozilla/5.0" 42 "my-router" "http://backend:8080" 150ms`

	parsed, err := ParseTraefikLog(line)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if parsed == nil {
		t.Fatalf("expected parsed log, got nil")
	}

	if parsed.ClientHost != "192.168.1.100" {
		t.Fatalf("expected ClientHost 192.168.1.100, got %q", parsed.ClientHost)
	}
	if parsed.ClientUsername != "user" {
		t.Fatalf("expected ClientUsername user, got %q", parsed.ClientUsername)
	}
	if parsed.RequestMethod != "GET" {
		t.Fatalf("expected method GET, got %q", parsed.RequestMethod)
	}
	if parsed.RequestProtocol != "HTTP/1.1" {
		t.Fatalf("expected protocol HTTP/1.1, got %q", parsed.RequestProtocol)
	}
	if parsed.DownstreamStatus != 200 {
		t.Fatalf("expected status 200, got %d", parsed.DownstreamStatus)
	}
	if parsed.DownstreamContentSize != 1024 {
		t.Fatalf("expected content size 1024, got %d", parsed.DownstreamContentSize)
	}
	if parsed.RequestCount != 42 {
		t.Fatalf("expected request count 42, got %d", parsed.RequestCount)
	}
	if parsed.RouterName != "my-router" {
		t.Fatalf("expected router my-router, got %q", parsed.RouterName)
	}
	if parsed.ServiceURL != "http://backend:8080" {
		t.Fatalf("expected service url http://backend:8080, got %q", parsed.ServiceURL)
	}
	if parsed.Duration != 150000000 {
		t.Fatalf("expected duration 150000000ns, got %d", parsed.Duration)
	}
}

func TestParseTraefikLog_GenericCLFFallback(t *testing.T) {
	line := `192.168.1.100 - - [15/May/2025:12:06:30 +0000] "POST /api/users HTTP/1.1" 201 512 "https://app.example.com" "curl/7.68.0"`

	parsed, err := ParseTraefikLog(line)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if parsed == nil {
		t.Fatalf("expected parsed log, got nil")
	}

	if parsed.RequestMethod != "POST" {
		t.Fatalf("expected method POST, got %q", parsed.RequestMethod)
	}
	if parsed.RequestPath != "/api/users" {
		t.Fatalf("expected path /api/users, got %q", parsed.RequestPath)
	}
	if parsed.DownstreamStatus != 201 {
		t.Fatalf("expected status 201, got %d", parsed.DownstreamStatus)
	}
	if parsed.DownstreamContentSize != 512 {
		t.Fatalf("expected content size 512, got %d", parsed.DownstreamContentSize)
	}
	if parsed.RequestCount != 0 {
		t.Fatalf("expected request count 0 for generic CLF, got %d", parsed.RequestCount)
	}
}

func TestParseTraefikLog_UnknownReturnsNil(t *testing.T) {
	parsed, err := ParseTraefikLog("not a traefik log line")
	if err != nil {
		t.Fatalf("expected no error for unknown line, got %v", err)
	}
	if parsed != nil {
		t.Fatalf("expected nil parsed log for unknown format")
	}
}

func TestParseTraefikLog_InvalidJSONReturnsError(t *testing.T) {
	parsed, err := ParseTraefikLog(`{"invalid":`)
	if err == nil {
		t.Fatalf("expected error for malformed JSON")
	}
	if parsed != nil {
		t.Fatalf("expected nil parsed log for malformed JSON")
	}
}

func TestParseTraefikLog_CLFDashFields(t *testing.T) {
	line := `192.168.1.100 - - [15/May/2025:12:06:30 +0000] "GET /api HTTP/1.1" 200 - "-" "-" 42 "-" "-" 150ms`

	parsed, err := ParseTraefikLog(line)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if parsed == nil {
		t.Fatalf("expected parsed log, got nil")
	}

	if parsed.DownstreamContentSize != 0 {
		t.Fatalf("expected size fallback to 0, got %d", parsed.DownstreamContentSize)
	}
	if parsed.RequestReferer != "" {
		t.Fatalf("expected empty referer, got %q", parsed.RequestReferer)
	}
	if parsed.RequestUserAgent != "" {
		t.Fatalf("expected empty user-agent, got %q", parsed.RequestUserAgent)
	}
	if parsed.RouterName != "" {
		t.Fatalf("expected empty router name, got %q", parsed.RouterName)
	}
	if parsed.ServiceURL != "" {
		t.Fatalf("expected empty service URL, got %q", parsed.ServiceURL)
	}
}

func TestParseTraefikLogsBatchedMatchesSequential(t *testing.T) {
	lines := []string{
		`{"ClientAddr":"1.1.1.1:1234","RequestMethod":"GET","RequestPath":"/","DownstreamStatus":200}`,
		`192.168.1.100 - - [15/May/2025:12:06:30 +0000] "GET /api HTTP/1.1" 200 1024 "-" "Mozilla/5.0"`,
		`invalid line`,
	}

	sequential := ParseTraefikLogs(lines)
	batched := ParseTraefikLogsBatched(lines, 2)

	if len(sequential) != len(batched) {
		t.Fatalf("expected same parsed count, sequential=%d batched=%d", len(sequential), len(batched))
	}
}

func TestParserMetricsCounters(t *testing.T) {
	ResetParserMetrics()

	lines := []string{
		`{"ClientAddr":"1.1.1.1:1234","RequestMethod":"GET","RequestPath":"/","DownstreamStatus":200}`,
		`192.168.1.100 - - [15/May/2025:12:06:30 +0000] "GET /api HTTP/1.1" 200 1024 "-" "Mozilla/5.0" 42 "router" "http://backend" 150ms`,
		`192.168.1.100 - - [15/May/2025:12:06:30 +0000] "GET /api HTTP/1.1" 200 1024 "-" "Mozilla/5.0"`,
		`not a traefik log line`,
		`{"invalid":`,
	}

	for _, line := range lines {
		_, _ = ParseTraefikLog(line)
	}

	metrics := GetParserMetrics()

	if metrics.JSON != 2 {
		t.Fatalf("expected JSON counter 2, got %d", metrics.JSON)
	}
	if metrics.TraefikCLF != 1 {
		t.Fatalf("expected TraefikCLF counter 1, got %d", metrics.TraefikCLF)
	}
	if metrics.GenericCLF != 1 {
		t.Fatalf("expected GenericCLF counter 1, got %d", metrics.GenericCLF)
	}
	if metrics.Unknown != 1 {
		t.Fatalf("expected Unknown counter 1, got %d", metrics.Unknown)
	}
	if metrics.Errors != 1 {
		t.Fatalf("expected Errors counter 1, got %d", metrics.Errors)
	}

	ResetParserMetrics()
	metrics = GetParserMetrics()
	if metrics.JSON != 0 || metrics.TraefikCLF != 0 || metrics.GenericCLF != 0 || metrics.Unknown != 0 || metrics.Errors != 0 {
		t.Fatalf("expected all metrics reset to zero, got %+v", metrics)
	}
}
