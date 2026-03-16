package logs

import (
	"encoding/json"
	"fmt"
	"net"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type TraefikLog struct {
	ClientAddr            string    `json:"ClientAddr"`
	ClientHost            string    `json:"ClientHost"`
	ClientPort            string    `json:"ClientPort"`
	ClientUsername        string    `json:"ClientUsername"`
	DownstreamContentSize int64     `json:"DownstreamContentSize"`
	DownstreamStatus      int       `json:"DownstreamStatus"`
	Duration              int64     `json:"Duration"`
	OriginContentSize     int64     `json:"OriginContentSize"`
	OriginDuration        int64     `json:"OriginDuration"`
	OriginStatus          int       `json:"OriginStatus"`
	Overhead              int64     `json:"Overhead"`
	RequestAddr           string    `json:"RequestAddr"`
	RequestContentSize    int64     `json:"RequestContentSize"`
	RequestCount          int       `json:"RequestCount"`
	RequestHost           string    `json:"RequestHost"`
	RequestMethod         string    `json:"RequestMethod"`
	RequestPath           string    `json:"RequestPath"`
	RequestPort           string    `json:"RequestPort"`
	RequestProtocol       string    `json:"RequestProtocol"`
	RequestScheme         string    `json:"RequestScheme"`
	RetryAttempts         int       `json:"RetryAttempts"`
	RouterName            string    `json:"RouterName"`
	ServiceAddr           string    `json:"ServiceAddr"`
	ServiceName           string    `json:"ServiceName"`
	ServiceURL            string    `json:"ServiceURL"`
	StartLocal            time.Time `json:"StartLocal"`
	StartUTC              time.Time `json:"StartUTC"`
	EntryPointName        string    `json:"entryPointName"`
	RequestReferer        string    `json:"RequestReferer,omitempty"`
	RequestUserAgent      string    `json:"RequestUserAgent,omitempty"`
	RequestRefererHeader  string    `json:"request_Referer,omitempty"`
	RequestUserAgentField string    `json:"request_User-Agent,omitempty"`

	// Request headers (Traefik uses "request_" prefix)
	RequestCFConnectingIP string `json:"request_CF-Connecting-IP,omitempty"`
	RequestXForwardedFor  string `json:"request_X-Forwarded-For,omitempty"`
	RequestXRealIP        string `json:"request_X-Real-IP,omitempty"`

	// Response headers
	DownstreamContentType string `json:"downstream_Content-Type,omitempty"`

	// Log metadata (present in error/info log entries)
	Level string `json:"level,omitempty"`
	Msg   string `json:"msg,omitempty"`
	Time  string `json:"time,omitempty"`
}

type logFormat int

const (
	formatUnknown logFormat = iota
	formatJSON
	formatTraefikCLF
	formatGenericCLF
)

const (
	traefikCLFPattern = `^(\S+)\s+\S+\s+(\S+)\s+\[([^\]]+)\]\s+"([A-Z]+)\s+([^"]*?)\s+HTTP/([0-9.]+)"\s+(\d{3})\s+(\d+|-)\s+"([^"]*)"\s+"([^"]*)"\s+(\d+)\s+"([^"]*)"\s+"([^"]*)"\s+(\d+)ms$`
	genericCLFPattern = `^(\S+)\s+\S+\s+(\S+)\s+\[([^\]]+)\]\s+"([A-Z]+)\s+([^"]*?)\s+HTTP/([0-9.]+)"\s+(\d{3})\s+(\d+|-)\s+"([^"]*)"\s+"([^"]*)"$`
)

type parserEngine struct {
	traefikCLFRegex *regexp.Regexp
	genericCLFRegex *regexp.Regexp
}

var defaultParser = newParserEngine()

type parserCounters struct {
	json       atomic.Uint64
	traefikCLF atomic.Uint64
	genericCLF atomic.Uint64
	unknown    atomic.Uint64
	errors     atomic.Uint64
}

var parseCounters parserCounters

type ParserMetrics struct {
	JSON       uint64 `json:"json"`
	TraefikCLF uint64 `json:"traefik_clf"`
	GenericCLF uint64 `json:"generic_clf"`
	Unknown    uint64 `json:"unknown"`
	Errors     uint64 `json:"errors"`
}

func GetParserMetrics() ParserMetrics {
	return ParserMetrics{
		JSON:       parseCounters.json.Load(),
		TraefikCLF: parseCounters.traefikCLF.Load(),
		GenericCLF: parseCounters.genericCLF.Load(),
		Unknown:    parseCounters.unknown.Load(),
		Errors:     parseCounters.errors.Load(),
	}
}

func ResetParserMetrics() {
	parseCounters.json.Store(0)
	parseCounters.traefikCLF.Store(0)
	parseCounters.genericCLF.Store(0)
	parseCounters.unknown.Store(0)
	parseCounters.errors.Store(0)
}

func newParserEngine() *parserEngine {
	return &parserEngine{
		traefikCLFRegex: regexp.MustCompile(traefikCLFPattern),
		genericCLFRegex: regexp.MustCompile(genericCLFPattern),
	}
}

func ParseTraefikLog(logLine string) (*TraefikLog, error) {
	return defaultParser.Parse(logLine)
}

func (p *parserEngine) Parse(logLine string) (*TraefikLog, error) {
	if len(logLine) == 0 {
		return nil, nil
	}

	logLine = strings.TrimSpace(logLine)
	if logLine == "" {
		return nil, nil
	}

	switch p.detectFormat(logLine) {
	case formatJSON:
		parseCounters.json.Add(1)
		parsed, err := p.parseJSONLog(logLine)
		if err != nil {
			parseCounters.errors.Add(1)
		}
		return parsed, err
	case formatTraefikCLF:
		parseCounters.traefikCLF.Add(1)
		matches := p.traefikCLFRegex.FindStringSubmatch(logLine)
		if matches == nil {
			return nil, nil
		}
		parsed, err := p.parseTraefikCLF(matches)
		if err != nil {
			parseCounters.errors.Add(1)
		}
		return parsed, err
	case formatGenericCLF:
		parseCounters.genericCLF.Add(1)
		matches := p.genericCLFRegex.FindStringSubmatch(logLine)
		if matches == nil {
			return nil, nil
		}
		parsed, err := p.parseGenericCLF(matches)
		if err != nil {
			parseCounters.errors.Add(1)
		}
		return parsed, err
	default:
		// Keep skip semantics for stability in streaming callers.
		parseCounters.unknown.Add(1)
		return nil, nil
	}
}

func (p *parserEngine) detectFormat(logLine string) logFormat {
	if len(logLine) == 0 {
		return formatUnknown
	}

	if logLine[0] == '{' {
		return formatJSON
	}

	if p.traefikCLFRegex.MatchString(logLine) {
		return formatTraefikCLF
	}

	if p.genericCLFRegex.MatchString(logLine) {
		return formatGenericCLF
	}

	return formatUnknown
}

func (p *parserEngine) parseJSONLog(logLine string) (*TraefikLog, error) {
	var parsed TraefikLog
	if err := json.Unmarshal([]byte(logLine), &parsed); err != nil {
		return nil, fmt.Errorf("invalid JSON log line: %w", err)
	}

	normalizeTypedJSONFields(&parsed)

	needsRawFallback := parsed.StartUTC.IsZero() ||
		(parsed.ClientHost == "" && parsed.ClientAddr == "" && parsed.RequestXRealIP == "")

	if needsRawFallback {
		var raw map[string]any
		if err := json.Unmarshal([]byte(logLine), &raw); err == nil {
			normalizeRawJSONFields(&parsed, raw)
		}
	}

	return &parsed, nil
}

func (p *parserEngine) parseTraefikCLF(matches []string) (*TraefikLog, error) {
	if len(matches) < 15 {
		return nil, fmt.Errorf("invalid Traefik CLF format: expected 15 capture groups, got %d", len(matches))
	}

	clientHost, clientPort := splitHostPort(matches[1])
	clientUser := normalizeDashField(matches[2])
	timestamp := parseCLFTimestamp(matches[3])
	method := normalizeCLFMethod(matches[4])
	requestPath := normalizeCLFPath(matches[5])
	protocol := buildHTTPProtocol(matches[6])
	status := parseStatusCode(matches[7])
	contentSize := parseCLFSize(matches[8])
	referer := normalizeDashField(matches[9])
	userAgent := normalizeDashField(matches[10])
	requestCount := parseNonNegativeInt(matches[11])
	router := normalizeDashField(matches[12])
	serviceURL := normalizeDashField(matches[13])
	durationMs := parseNonNegativeInt64(matches[14])

	return &TraefikLog{
		ClientHost:            clientHost,
		ClientPort:            clientPort,
		ClientUsername:        clientUser,
		RequestMethod:         method,
		RequestPath:           requestPath,
		RequestProtocol:       protocol,
		OriginStatus:          status,
		DownstreamStatus:      status,
		OriginContentSize:     contentSize,
		DownstreamContentSize: contentSize,
		RequestReferer:        referer,
		RequestUserAgent:      userAgent,
		RequestCount:          requestCount,
		RouterName:            router,
		ServiceURL:            serviceURL,
		Duration:              durationMs * int64(time.Millisecond),
		StartUTC:              timestamp,
		StartLocal:            timestamp.Local(),
	}, nil
}

func (p *parserEngine) parseGenericCLF(matches []string) (*TraefikLog, error) {
	if len(matches) < 11 {
		return nil, fmt.Errorf("invalid generic CLF format: expected 11 capture groups, got %d", len(matches))
	}

	clientHost, clientPort := splitHostPort(matches[1])
	clientUser := normalizeDashField(matches[2])
	timestamp := parseCLFTimestamp(matches[3])
	method := normalizeCLFMethod(matches[4])
	requestPath := normalizeCLFPath(matches[5])
	protocol := buildHTTPProtocol(matches[6])
	status := parseStatusCode(matches[7])
	contentSize := parseCLFSize(matches[8])
	referer := normalizeDashField(matches[9])
	userAgent := normalizeDashField(matches[10])

	return &TraefikLog{
		ClientHost:            clientHost,
		ClientPort:            clientPort,
		ClientUsername:        clientUser,
		RequestMethod:         method,
		RequestPath:           requestPath,
		RequestProtocol:       protocol,
		OriginStatus:          status,
		DownstreamStatus:      status,
		OriginContentSize:     contentSize,
		DownstreamContentSize: contentSize,
		RequestReferer:        referer,
		RequestUserAgent:      userAgent,
		StartUTC:              timestamp,
		StartLocal:            timestamp.Local(),
	}, nil
}

func normalizeTypedJSONFields(parsed *TraefikLog) {
	parsed.RequestMethod = normalizeCLFMethod(parsed.RequestMethod)
	parsed.RequestPath = normalizeCLFPath(parsed.RequestPath)

	if parsed.ClientHost == "" {
		parsed.ClientHost = firstNonEmpty(parsed.RequestXRealIP, extractHost(parsed.ClientAddr))
	}
	if parsed.ClientAddr == "" {
		parsed.ClientAddr = parsed.ClientHost
	}
	if parsed.ClientPort == "" {
		_, parsed.ClientPort = splitHostPort(parsed.ClientAddr)
	}
	if parsed.StartLocal.IsZero() && !parsed.StartUTC.IsZero() {
		parsed.StartLocal = parsed.StartUTC.Local()
	}

	if parsed.DownstreamStatus == 0 && parsed.OriginStatus != 0 {
		parsed.DownstreamStatus = parsed.OriginStatus
	}
	if parsed.OriginStatus == 0 && parsed.DownstreamStatus != 0 {
		parsed.OriginStatus = parsed.DownstreamStatus
	}
	if parsed.DownstreamStatus < 100 || parsed.DownstreamStatus >= 600 {
		parsed.DownstreamStatus = 0
	}
	if parsed.OriginStatus < 100 || parsed.OriginStatus >= 600 {
		parsed.OriginStatus = parsed.DownstreamStatus
	}

	if parsed.DownstreamContentSize == 0 && parsed.OriginContentSize != 0 {
		parsed.DownstreamContentSize = parsed.OriginContentSize
	}
	if parsed.OriginContentSize == 0 && parsed.DownstreamContentSize != 0 {
		parsed.OriginContentSize = parsed.DownstreamContentSize
	}

	if parsed.RequestReferer == "" {
		parsed.RequestReferer = parsed.RequestRefererHeader
	}
	if parsed.RequestUserAgent == "" {
		parsed.RequestUserAgent = parsed.RequestUserAgentField
	}
}

func normalizeRawJSONFields(parsed *TraefikLog, raw map[string]any) {
	parsed.RequestMethod = normalizeCLFMethod(firstNonEmpty(parsed.RequestMethod, getString(raw, "RequestMethod")))
	parsed.RequestPath = normalizeCLFPath(firstNonEmpty(parsed.RequestPath, getString(raw, "RequestPath")))

	// Prefer header-derived client IP, then Traefik fields.
	clientIP := firstNonEmpty(
		parsed.RequestXRealIP,
		getString(raw, "request_X-Real-IP"),
		parsed.ClientHost,
		getString(raw, "ClientHost"),
		extractHost(firstNonEmpty(parsed.ClientAddr, getString(raw, "ClientAddr"))),
	)
	if parsed.ClientHost == "" {
		parsed.ClientHost = clientIP
	}

	if parsed.ClientAddr == "" {
		parsed.ClientAddr = firstNonEmpty(getString(raw, "ClientAddr"), clientIP)
	}

	if parsed.ClientPort == "" {
		_, parsed.ClientPort = splitHostPort(parsed.ClientAddr)
	}

	if parsed.StartUTC.IsZero() {
		if ts := parseJSONTimestamp(raw); !ts.IsZero() {
			parsed.StartUTC = ts
			if parsed.StartLocal.IsZero() {
				parsed.StartLocal = ts.Local()
			}
		}
	}

	if parsed.DownstreamStatus == 0 && parsed.OriginStatus != 0 {
		parsed.DownstreamStatus = parsed.OriginStatus
	}
	if parsed.OriginStatus == 0 && parsed.DownstreamStatus != 0 {
		parsed.OriginStatus = parsed.DownstreamStatus
	}
	if parsed.DownstreamStatus < 100 || parsed.DownstreamStatus >= 600 {
		parsed.DownstreamStatus = 0
	}
	if parsed.OriginStatus < 100 || parsed.OriginStatus >= 600 {
		parsed.OriginStatus = parsed.DownstreamStatus
	}

	if parsed.DownstreamContentSize == 0 && parsed.OriginContentSize != 0 {
		parsed.DownstreamContentSize = parsed.OriginContentSize
	}
	if parsed.OriginContentSize == 0 && parsed.DownstreamContentSize != 0 {
		parsed.OriginContentSize = parsed.DownstreamContentSize
	}

	if parsed.RequestReferer == "" {
		parsed.RequestReferer = firstNonEmpty(parsed.RequestRefererHeader, getString(raw, "RequestReferer"), getString(raw, "request_Referer"))
	}
	if parsed.RequestUserAgent == "" {
		parsed.RequestUserAgent = firstNonEmpty(parsed.RequestUserAgentField, getString(raw, "RequestUserAgent"), getString(raw, "request_User-Agent"))
	}
}

func parseJSONTimestamp(raw map[string]any) time.Time {
	for _, key := range []string{"StartUTC", "time", "Time"} {
		value, ok := raw[key]
		if !ok {
			continue
		}
		parsed := parseAnyTime(value)
		if !parsed.IsZero() {
			return parsed
		}
	}
	return time.Time{}
}

func parseAnyTime(value any) time.Time {
	str := strings.TrimSpace(getStringFromAny(value))
	if str == "" {
		return time.Time{}
	}

	for _, layout := range []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T15:04:05.000Z07:00",
		"2006-01-02T15:04:05Z07:00",
	} {
		if parsed, err := time.Parse(layout, str); err == nil {
			return parsed
		}
	}
	return time.Time{}
}

func parseCLFTimestamp(value string) time.Time {
	parsed, err := time.Parse("02/Jan/2006:15:04:05 -0700", strings.TrimSpace(value))
	if err != nil {
		return time.Now()
	}
	return parsed
}

func parseStatusCode(value string) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed < 100 || parsed >= 600 {
		return 0
	}
	return parsed
}

func parseCLFSize(value string) int64 {
	value = strings.TrimSpace(value)
	if value == "" || value == "-" {
		return 0
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed < 0 {
		return 0
	}
	return parsed
}

func parseNonNegativeInt(value string) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed < 0 {
		return 0
	}
	return parsed
}

func parseNonNegativeInt64(value string) int64 {
	parsed, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	if err != nil || parsed < 0 {
		return 0
	}
	return parsed
}

func normalizeDashField(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "-" {
		return ""
	}
	return trimmed
}

func normalizeCLFMethod(value string) string {
	method := strings.TrimSpace(value)
	if method == "" || method == "-" {
		return "GET"
	}
	return strings.ToUpper(method)
}

func normalizeCLFPath(value string) string {
	path := strings.TrimSpace(value)
	if path == "" || path == "-" {
		return "/"
	}
	return path
}

func buildHTTPProtocol(version string) string {
	trimmed := strings.TrimSpace(version)
	if trimmed == "" || trimmed == "-" {
		return ""
	}
	if strings.HasPrefix(strings.ToUpper(trimmed), "HTTP/") {
		return trimmed
	}
	return "HTTP/" + trimmed
}

func splitHostPort(client string) (host string, port string) {
	client = strings.TrimSpace(client)
	if client == "" {
		return "", ""
	}

	parsedHost, parsedPort, err := net.SplitHostPort(client)
	if err == nil {
		return parsedHost, parsedPort
	}
	return client, ""
}

func extractHost(client string) string {
	host, _ := splitHostPort(client)
	return host
}

func getString(raw map[string]any, key string) string {
	value, ok := raw[key]
	if !ok {
		return ""
	}
	return strings.TrimSpace(getStringFromAny(value))
}

func getStringFromAny(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case json.Number:
		return typed.String()
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	case int:
		return strconv.Itoa(typed)
	case int64:
		return strconv.FormatInt(typed, 10)
	default:
		return ""
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

// ParseTraefikLogs parses multiple lines sequentially.
func ParseTraefikLogs(logLines []string) []*TraefikLog {
	logs := make([]*TraefikLog, 0, len(logLines))
	for _, line := range logLines {
		log, err := ParseTraefikLog(line)
		if err == nil && log != nil {
			logs = append(logs, log)
		}
	}
	return logs
}

func ParseTraefikLogsBatched(logLines []string, batchSize int) []*TraefikLog {
	if batchSize <= 0 {
		batchSize = 1000
	}

	numBatches := (len(logLines) + batchSize - 1) / batchSize
	results := make([][]*TraefikLog, numBatches)

	var wg sync.WaitGroup
	for i := 0; i < numBatches; i++ {
		wg.Add(1)
		go func(batchIdx int) {
			defer wg.Done()

			start := batchIdx * batchSize
			end := start + batchSize
			if end > len(logLines) {
				end = len(logLines)
			}

			batch := logLines[start:end]
			batchResults := make([]*TraefikLog, 0, len(batch))
			for _, line := range batch {
				log, err := ParseTraefikLog(line)
				if err == nil && log != nil {
					batchResults = append(batchResults, log)
				}
			}

			results[batchIdx] = batchResults
		}(i)
	}
	wg.Wait()

	totalLogs := 0
	for _, batch := range results {
		totalLogs += len(batch)
	}

	merged := make([]*TraefikLog, 0, totalLogs)
	for _, batch := range results {
		merged = append(merged, batch...)
	}
	return merged
}
