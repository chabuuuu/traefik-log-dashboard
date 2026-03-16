package routes

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/dashboard"
	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/utils"
)

// HandleNotify proxies notification requests to Discord/Telegram.
// Browsers cannot POST directly to these services due to CORS restrictions,
// so the agent acts as a thin proxy.
//
// POST /api/notify
// Body: { "type": "discord"|"telegram", "url": "...", "message": "...", "title": "..." }
func (h *Handler) HandleNotify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.RespondJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req dashboard.NotifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.URL == "" {
		utils.RespondJSON(w, http.StatusBadRequest, map[string]string{"error": "url is required"})
		return
	}
	if req.Message == "" {
		utils.RespondJSON(w, http.StatusBadRequest, map[string]string{"error": "message is required"})
		return
	}

	var err error
	switch req.Type {
	case "discord":
		err = dashboard.SendDiscordNotification(req.URL, req.Title, req.Message)
	case "telegram":
		err = dashboard.SendTelegramNotification(req.URL, req.Title, req.Message)
	default:
		utils.RespondJSON(w, http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("unsupported notification type: %s", req.Type),
		})
		return
	}

	if err != nil {
		utils.RespondJSON(w, http.StatusBadGateway, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
	})
}
