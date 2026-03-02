package middleware

import (
	"encoding/json"
	"net/http"
	"regexp"
)

// Compiled patterns for malicious request detection.
// These are compiled once at package init time.
var (
	sqlInjectionPattern   = regexp.MustCompile(`(?i)(union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+.*set)`)
	xssPattern            = regexp.MustCompile(`(?i)(<script|javascript:|on\w+\s*=)`)
	pathTraversalPattern  = regexp.MustCompile(`\.\./|\.\.\\`)
)

// MaliciousPatternScanner returns a middleware that inspects the URL path and query
// string for common attack patterns (SQL injection, XSS, path traversal).
// Requests matching a pattern receive a 400 Bad Request response.
func MaliciousPatternScanner() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			target := r.URL.Path + "?" + r.URL.RawQuery

			if sqlInjectionPattern.MatchString(target) ||
				xssPattern.MatchString(target) ||
				pathTraversalPattern.MatchString(target) {

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "malicious pattern detected",
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
