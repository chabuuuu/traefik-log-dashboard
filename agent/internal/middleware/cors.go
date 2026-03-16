package middleware

import (
	"net/http"
	"os"
)

// CORSConfig holds CORS configuration options
type CORSConfig struct {
	AllowOrigin  string
	AllowMethods string
	AllowHeaders string
}

// DefaultCORSConfig returns a CORS configuration. The allowed origin can be
// controlled via the CORS_ALLOW_ORIGIN environment variable; it falls back to
// "*" when the variable is unset or empty.
func DefaultCORSConfig() CORSConfig {
	origin := os.Getenv("CORS_ALLOW_ORIGIN")
	if origin == "" {
		origin = "*"
	}
	return CORSConfig{
		AllowOrigin:  origin,
		AllowMethods: "GET, POST, OPTIONS",
		AllowHeaders: "Content-Type, Authorization",
	}
}

// CORS returns a middleware that handles CORS headers and preflight requests
func CORS(config CORSConfig) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Set CORS headers
			w.Header().Set("Access-Control-Allow-Origin", config.AllowOrigin)
			w.Header().Set("Access-Control-Allow-Methods", config.AllowMethods)
			w.Header().Set("Access-Control-Allow-Headers", config.AllowHeaders)

			// Handle preflight requests
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusOK)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
