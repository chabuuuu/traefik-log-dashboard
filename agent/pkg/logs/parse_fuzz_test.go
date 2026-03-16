package logs

import "testing"

func FuzzParseTraefikLog(f *testing.F) {
	seeds := []string{
		`{"ClientAddr":"1.1.1.1:1234","RequestMethod":"GET","RequestPath":"/","DownstreamStatus":200}`,
		`{"time":"2025-10-25T21:11:49Z","request_X-Real-IP":"103.4.250.66","RequestPath":"/fallback"}`,
		`192.168.1.100 - - [15/May/2025:12:06:30 +0000] "GET /api HTTP/1.1" 200 1024 "-" "Mozilla/5.0" 42 "router" "http://backend" 150ms`,
		`192.168.1.100 - - [15/May/2025:12:06:30 +0000] "GET /api HTTP/1.1" 200 1024 "-" "Mozilla/5.0"`,
		`{"invalid":`,
		`not a traefik log line`,
		``,
	}

	for _, seed := range seeds {
		f.Add(seed)
	}

	f.Fuzz(func(t *testing.T, line string) {
		parsed, err := ParseTraefikLog(line)
		if err != nil {
			return
		}
		if parsed == nil {
			return
		}

		if parsed.RequestMethod == "" {
			t.Fatalf("parsed log has empty RequestMethod")
		}
		if parsed.RequestPath == "" {
			t.Fatalf("parsed log has empty RequestPath")
		}
	})
}
