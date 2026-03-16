package dashboard

// NotifyRequest is the request body for the /api/notify proxy endpoint.
type NotifyRequest struct {
	Type    string `json:"type"`    // "discord" or "telegram"
	URL     string `json:"url"`     // Webhook URL
	Message string `json:"message"` // Message text
	Title   string `json:"title"`   // Title/subject line
}
