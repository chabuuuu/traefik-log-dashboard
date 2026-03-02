package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/utils"
	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/logger"
	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/logs"
)

// HandleAccessLogs handles requests for access logs
func (h *Handler) HandleAccessLogs(w http.ResponseWriter, r *http.Request) {
	// Get query parameters
	position := utils.GetQueryParamInt64(r, "position", -2) // -2 means use tracked position
	lines := utils.GetQueryParamInt(r, "lines", 1000)
	tail := utils.GetQueryParamBool(r, "tail", false)

	// Check if path exists
	fileInfo, err := os.Stat(h.config.AccessPath)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var result logs.LogResult

	if fileInfo.IsDir() {
		// For directories, get logs from all files
		if tail || position == -2 {
			// First request or tail mode - get last N lines
			positions := []logs.Position{}
			result, err = logs.GetLogs(h.config.AccessPath, positions, false, false)
		} else {
			// Use provided position
			positions := []logs.Position{{Position: position}}
			result, err = logs.GetLogs(h.config.AccessPath, positions, false, false)
		}
	} else {
		// Single file
		trackedPos := h.state.GetFilePosition(h.config.AccessPath)

		// Determine position to use
		var usePosition int64
		if position == -2 {
			// Use tracked position
			usePosition = trackedPos
		} else if position == -1 || tail {
			// Tail mode requested
			usePosition = -1
		} else {
			// Use provided position
			usePosition = position
		}

		positions := []logs.Position{{Position: usePosition}}
		result, err = logs.GetLogs(h.config.AccessPath, positions, false, false)

		// Update tracked position if we got results
		if err == nil && len(result.Positions) > 0 {
			h.state.SetFilePosition(h.config.AccessPath, result.Positions[0].Position)
		}
	}

	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Limit the number of logs returned
	if len(result.Logs) > lines {
		// Keep only the most recent logs
		startIdx := len(result.Logs) - lines
		result.Logs = result.Logs[startIdx:]
	}

	utils.RespondJSON(w, http.StatusOK, result)
}

// HandleErrorLogs handles requests for error logs
func (h *Handler) HandleErrorLogs(w http.ResponseWriter, r *http.Request) {
	position := utils.GetQueryParamInt64(r, "position", -2)
	lines := utils.GetQueryParamInt(r, "lines", 100)
	tail := utils.GetQueryParamBool(r, "tail", false)

	fileInfo, err := os.Stat(h.config.ErrorPath)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var result logs.LogResult

	if fileInfo.IsDir() {
		if tail || position == -2 {
			positions := []logs.Position{}
			result, err = logs.GetLogs(h.config.ErrorPath, positions, true, false)
		} else {
			positions := []logs.Position{{Position: position}}
			result, err = logs.GetLogs(h.config.ErrorPath, positions, true, false)
		}
	} else {
		trackedPos := h.state.GetFilePosition(h.config.ErrorPath)

		var usePosition int64
		if position == -2 {
			usePosition = trackedPos
		} else if position == -1 || tail {
			usePosition = -1
		} else {
			usePosition = position
		}

		positions := []logs.Position{{Position: usePosition}}
		result, err = logs.GetLogs(h.config.ErrorPath, positions, true, false)

		if err == nil && len(result.Positions) > 0 {
			h.state.SetFilePosition(h.config.ErrorPath, result.Positions[0].Position)
		}
	}

	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if len(result.Logs) > lines {
		startIdx := len(result.Logs) - lines
		result.Logs = result.Logs[startIdx:]
	}

	utils.RespondJSON(w, http.StatusOK, result)
}

// HandleGetLog handles requests for a specific log file
func (h *Handler) HandleGetLog(w http.ResponseWriter, r *http.Request) {
	filename := utils.GetQueryParam(r, "filename", "")
	if filename == "" {
		utils.RespondError(w, http.StatusBadRequest, "filename parameter is required")
		return
	}

	position := utils.GetQueryParamInt64(r, "position", 0)
	lines := utils.GetQueryParamInt(r, "lines", 100)

	fullPath := filepath.Join(h.config.AccessPath, filename)

	positions := []logs.Position{{Position: position, Filename: filename}}
	result, err := logs.GetLogs(fullPath, positions, false, false)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if len(result.Logs) > lines {
		result.Logs = result.Logs[:lines]
	}

	utils.RespondJSON(w, http.StatusOK, result)
}

// HandleStreamAccessLogs streams access logs over SSE with light batching/backpressure.
func (h *Handler) HandleStreamAccessLogs(w http.ResponseWriter, r *http.Request) {
	if h.streamClients.Load() >= int32(h.config.StreamMaxClients) {
		utils.RespondError(w, http.StatusServiceUnavailable, "too many streaming clients")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		utils.RespondError(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	h.streamClients.Add(1)
	defer h.streamClients.Add(-1)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	ctx := r.Context()
	startPos := h.state.GetFilePosition(h.config.AccessPath)
	currentPos := startPos

	flushInterval := time.Duration(h.config.StreamFlushIntervalMS) * time.Millisecond
	ticker := time.NewTicker(flushInterval)
	defer ticker.Stop()

	maxDuration := time.Duration(h.config.StreamMaxDurationSec) * time.Second
	timeout := time.NewTimer(maxDuration)
	defer timeout.Stop()

	// Initial comment to establish stream
	if _, err := w.Write([]byte(": stream-start\n\n")); err == nil {
		flusher.Flush()
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-timeout.C:
			_, _ = w.Write([]byte("event: end\ndata: stream timeout\n\n"))
			flusher.Flush()
			return
		case <-ticker.C:
			streamedLogs, nextPos, err := logs.StreamFromPosition(ctx, h.config.AccessPath, currentPos, h.config.StreamBatchLines, h.config.StreamMaxBytesPerBatch)
			if err != nil && err != context.Canceled {
				logger.Log.Printf("stream error: %v", err)
				utils.RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			if len(streamedLogs) == 0 {
				_, _ = w.Write([]byte(": keep-alive\n\n"))
				flusher.Flush()
				continue
			}

			var builder strings.Builder
			bytesUsed := 0
			maxBytes := h.config.StreamMaxBytesPerBatch
			if maxBytes <= 0 {
				maxBytes = 512 * 1024
			}

			for _, log := range streamedLogs {
				jsonBytes, jsonErr := json.Marshal(log)
				if jsonErr != nil {
					continue
				}
				entry := "data: " + string(jsonBytes) + "\n"
				if bytesUsed+len(entry)+1 > maxBytes {
					logger.Log.Printf("stream batch truncated at %d bytes", bytesUsed)
					break
				}
				builder.WriteString(entry)
				builder.WriteString("\n")
				bytesUsed += len(entry) + 1
			}

			if builder.Len() > 0 {
				if _, err := w.Write([]byte(builder.String())); err != nil {
					return
				}
				flusher.Flush()
			}

			currentPos = nextPos
			h.state.SetFilePosition(h.config.AccessPath, currentPos)
		}
	}
}
