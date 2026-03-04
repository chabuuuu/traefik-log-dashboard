package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLoggerPreservesFlusherForStreamingHandlers(t *testing.T) {
	handler := Logger()(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming not supported", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		flusher.Flush()
	}))

	req := httptest.NewRequest(http.MethodGet, "/stream", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d (body=%s)", http.StatusOK, recorder.Code, recorder.Body.String())
	}
}
