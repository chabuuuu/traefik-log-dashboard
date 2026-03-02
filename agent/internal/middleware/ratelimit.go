package middleware

import (
	"encoding/json"
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"
)

// ipRecord holds the request timestamps for a single IP address.
type ipRecord struct {
	mu         sync.Mutex
	timestamps []time.Time
}

var (
	rateLimitStore sync.Map  // map[string]*ipRecord
	cleanupOnce    sync.Once // ensures only one cleanup goroutine is started
)

// startCleanup launches a background goroutine that removes stale IP entries
// from the rate limit store every 5 minutes.
func startCleanup(window time.Duration) {
	cleanupOnce.Do(func() {
		go func() {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				now := time.Now()
				rateLimitStore.Range(func(key, value any) bool {
					rec := value.(*ipRecord)
					rec.mu.Lock()
					// Remove the entry entirely if all timestamps are expired.
					allExpired := true
					for _, ts := range rec.timestamps {
						if now.Sub(ts) < window {
							allExpired = false
							break
						}
					}
					rec.mu.Unlock()
					if allExpired {
						rateLimitStore.Delete(key)
					}
					return true
				})
			}
		}()
	})
}

// extractIP returns the client IP address, preferring X-Forwarded-For over RemoteAddr.
func extractIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// X-Forwarded-For may contain a comma-separated list; use the first entry.
		for i := 0; i < len(xff); i++ {
			if xff[i] == ',' {
				return xff[:i]
			}
		}
		return xff
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// RateLimit returns a middleware that enforces a per-IP sliding window rate limit.
// If requestsPerMinute is <= 0 the middleware is a no-op (rate limiting disabled).
func RateLimit(requestsPerMinute int) Middleware {
	return func(next http.Handler) http.Handler {
		// Disabled — pass through.
		if requestsPerMinute <= 0 {
			return next
		}

		window := time.Minute
		startCleanup(window)

		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := extractIP(r)
			now := time.Now()
			cutoff := now.Add(-window)

			// Load or create the record for this IP.
			val, _ := rateLimitStore.LoadOrStore(ip, &ipRecord{})
			rec := val.(*ipRecord)

			rec.mu.Lock()

			// Prune timestamps outside the sliding window.
			valid := rec.timestamps[:0]
			for _, ts := range rec.timestamps {
				if ts.After(cutoff) {
					valid = append(valid, ts)
				}
			}
			rec.timestamps = valid

			if len(rec.timestamps) >= requestsPerMinute {
				// Calculate Retry-After as seconds until the oldest entry expires.
				oldest := rec.timestamps[0]
				retryAfter := oldest.Add(window).Sub(now)
				rec.mu.Unlock()

				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", strconv.Itoa(int(retryAfter.Seconds())+1))
				w.WriteHeader(http.StatusTooManyRequests)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "rate limit exceeded",
				})
				return
			}

			rec.timestamps = append(rec.timestamps, now)
			rec.mu.Unlock()

			next.ServeHTTP(w, r)
		})
	}
}
