package logs

import (
	"bufio"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/logger"
)

var (
	scanBufPool = sync.Pool{
		New: func() any {
			// 64KB buffer per scanner; cap defined in scanner below
			buf := make([]byte, 64*1024)
			return &buf
		},
	}
)

func GetLogs(path string, positions []Position, isErrorLog bool, includeCompressed bool) (LogResult, error) {
	return GetLogsWithLimit(path, positions, isErrorLog, includeCompressed, 1000)
}

func GetLogsWithLimit(path string, positions []Position, isErrorLog bool, includeCompressed bool, tailLines int) (LogResult, error) {
	fileInfo, err := os.Stat(path)
	if err != nil {
		return LogResult{}, fmt.Errorf("path error: %w", err)
	}

	if tailLines <= 0 {
		tailLines = 1000
	}

	var result LogResult
	if fileInfo.IsDir() {
		result, err = getDirectoryLogsWithLimit(path, positions, isErrorLog, includeCompressed, tailLines)
	} else {
		singlePos := int64(0)
		if len(positions) > 0 {
			singlePos = positions[0].Position
		}
		result, err = getLogWithLimit(path, singlePos, tailLines)
	}

	return result, err
}

func GetLog(filePath string, position int64) (LogResult, error) {
	return getLogWithLimit(filePath, position, 1000)
}

func getLogWithLimit(filePath string, position int64, tailLines int) (LogResult, error) {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		logger.Log.Println("File not found")
		return LogResult{}, fmt.Errorf("file not found: %s", filePath)
	}

	var result LogResult
	var err error

	if strings.HasSuffix(filePath, ".gz") {
		result, err = readCompressedLogFile(filePath)
		if err != nil {
			return LogResult{}, fmt.Errorf("error reading compressed log file: %w", err)
		}
	} else {
		result, err = readLogFile(filePath, position, tailLines)
		if err != nil {
			return LogResult{}, fmt.Errorf("error reading log file: %w", err)
		}
	}

	return result, nil
}

func readLogFile(filePath string, position int64, tailLines int) (LogResult, error) {
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return LogResult{}, err
	}

	fileSize := fileInfo.Size()

	// If position is -1, start from end of file (tail mode)
	if position == -1 {
		return tailLogFile(filePath, tailLines)
	}

	// If position >= fileSize, no new logs
	if position >= fileSize {
		return LogResult{
			Logs:      []*TraefikLog{},
			Positions: []Position{{Position: fileSize}},
		}, nil
	}

	file, err := os.Open(filePath)
	if err != nil {
		return LogResult{}, err
	}
	defer file.Close()

	_, err = file.Seek(position, 0)
	if err != nil {
		return LogResult{}, err
	}

	// PERFORMANCE FIX: Pre-allocate slice with estimated capacity
	parsedLogs := make([]*TraefikLog, 0, 1000)
	scanner := bufio.NewScanner(file)
	bufPtr := scanBufPool.Get().(*[]byte)
	defer scanBufPool.Put(bufPtr)
	scanner.Buffer(*bufPtr, 1024*1024) // Handle larger lines

	for scanner.Scan() {
		line := scanner.Text()
		if line != "" {
			parsed, parseErr := ParseTraefikLog(line)
			if parseErr == nil && parsed != nil {
				parsedLogs = append(parsedLogs, parsed)
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return LogResult{}, err
	}

	// Get current position after reading
	currentPos, _ := file.Seek(0, io.SeekCurrent)
	if currentPos < fileSize {
		currentPos = fileSize
	}

	return LogResult{
		Logs:      parsedLogs,
		Positions: []Position{{Position: currentPos}},
	}, nil
}

// StreamFromPosition reads new lines from a file starting at position and emits in batches.
// It stops on context cancellation or EOF without new data and returns the latest position.
func StreamFromPosition(ctx context.Context, filePath string, position int64, batchLines int, maxBytes int) (logs []*TraefikLog, nextPos int64, err error) {
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return nil, position, err
	}

	// No new data
	if position >= fileInfo.Size() {
		return []*TraefikLog{}, fileInfo.Size(), nil
	}

	f, err := os.Open(filePath)
	if err != nil {
		return nil, position, err
	}
	defer f.Close()

	if position > 0 {
		if _, err := f.Seek(position, io.SeekStart); err != nil {
			return nil, position, err
		}
	}

	reader := bufio.NewReaderSize(f, 64*1024)
	logs = make([]*TraefikLog, 0, batchLines)
	bytesUsed := 0
	if batchLines <= 0 {
		batchLines = 400
	}
	if maxBytes <= 0 {
		maxBytes = 512 * 1024
	}

	for len(logs) < batchLines && bytesUsed < maxBytes {
		select {
		case <-ctx.Done():
			return logs, position, ctx.Err()
		default:
		}

		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				position, _ = f.Seek(0, io.SeekCurrent)
				return logs, position, nil
			}
			return logs, position, err
		}

		trimmed := strings.TrimRight(line, "\r\n")
		if trimmed != "" {
			entrySize := len(trimmed) + 1 // include newline
			if bytesUsed+entrySize > maxBytes {
				// stop and return what we have; caller may re-read from current position
				position, _ = f.Seek(0, io.SeekCurrent)
				return logs, position, nil
			}
			parsed, parseErr := ParseTraefikLog(trimmed)
			if parseErr == nil && parsed != nil {
				logs = append(logs, parsed)
			}
			bytesUsed += entrySize
		}
	}

	position, _ = f.Seek(0, io.SeekCurrent)
	return logs, position, nil
}

// tailLogFile reads the last N lines from a file
// PERFORMANCE FIX: Avoid O(n²) prepending by collecting in reverse order and reversing once
func tailLogFile(filePath string, numLines int) (LogResult, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return LogResult{}, err
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return LogResult{}, err
	}

	fileSize := fileInfo.Size()

	// Pre-allocate slice with capacity to avoid reallocations
	rawLines := make([]string, 0, numLines)
	var offset int64 = 0
	bufferSize := int64(8192)

	for offset < fileSize && len(rawLines) < numLines {
		// Calculate read position
		readSize := bufferSize
		if offset+bufferSize > fileSize {
			readSize = fileSize - offset
		}

		startPos := fileSize - offset - readSize
		if startPos < 0 {
			startPos = 0
			readSize = fileSize - offset
		}

		// Read chunk
		buffer := make([]byte, readSize)
		_, err := file.ReadAt(buffer, startPos)
		if err != nil && err != io.EOF {
			break
		}

		// Split into lines (reading backwards)
		lines := strings.Split(string(buffer), "\n")

		// PERFORMANCE FIX: Collect lines in reverse order, then reverse once at the end
		// instead of prepending each line (which causes O(n²) allocations)
		for i := len(lines) - 1; i >= 0; i-- {
			if lines[i] != "" {
				rawLines = append(rawLines, lines[i])
				if len(rawLines) >= numLines {
					break
				}
			}
		}

		offset += readSize
		if startPos == 0 {
			break
		}
	}

	// Reverse the slice once (O(n) instead of O(n²))
	for i, j := 0, len(rawLines)-1; i < j; i, j = i+1, j-1 {
		rawLines[i], rawLines[j] = rawLines[j], rawLines[i]
	}

	// Trim to exact number of lines requested
	if len(rawLines) > numLines {
		rawLines = rawLines[len(rawLines)-numLines:]
	}

	// Parse raw lines into structured logs
	parsedLogs := make([]*TraefikLog, 0, len(rawLines))
	for _, line := range rawLines {
		parsed, parseErr := ParseTraefikLog(line)
		if parseErr == nil && parsed != nil {
			parsedLogs = append(parsedLogs, parsed)
		}
	}

	return LogResult{
		Logs:      parsedLogs,
		Positions: []Position{{Position: fileSize}},
	}, nil
}

// GetRecentLogs gets only logs newer than specified timestamp
func GetRecentLogs(path string, since time.Time) (LogResult, error) {
	fileInfo, err := os.Stat(path)
	if err != nil {
		return LogResult{}, fmt.Errorf("path error: %w", err)
	}

	if fileInfo.IsDir() {
		return GetRecentDirectoryLogs(path, since)
	}

	// For single file, read all and filter by time
	result, err := GetLog(path, 0)
	if err != nil {
		return result, err
	}

	// Filter logs by timestamp — now that logs are parsed, we can compare directly
	filteredLogs := make([]*TraefikLog, 0, len(result.Logs))
	for _, log := range result.Logs {
		if !log.StartUTC.IsZero() && !log.StartUTC.Before(since) {
			filteredLogs = append(filteredLogs, log)
		}
	}

	result.Logs = filteredLogs
	return result, nil
}

func GetRecentDirectoryLogs(dirPath string, since time.Time) (LogResult, error) {
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return LogResult{}, fmt.Errorf("failed to read directory: %w", err)
	}

	// PERFORMANCE FIX: Pre-allocate with estimated capacity
	allLogs := make([]*TraefikLog, 0, 1000)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		// Skip old files
		if info.ModTime().Before(since) {
			continue
		}

		fileName := entry.Name()
		if strings.HasSuffix(fileName, ".log") {
			fullPath := filepath.Join(dirPath, fileName)
			result, err := GetLog(fullPath, 0)
			if err != nil {
				logger.Log.Printf("Error reading log file %s: %v", fileName, err)
				continue
			}
			allLogs = append(allLogs, result.Logs...)
		}
	}

	return LogResult{
		Logs:      allLogs,
		Positions: []Position{},
	}, nil
}

func readErrorLogDirectly(filePath string, position int64) (LogResult, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return LogResult{}, err
	}

	strContent := string(content)

	if position >= int64(len(strContent)) {
		return LogResult{Logs: []*TraefikLog{}, Positions: []Position{{Position: position}}}, nil
	}

	newContent := strContent[position:]

	parsedLogs := []*TraefikLog{}
	for _, line := range strings.Split(newContent, "\n") {
		if strings.TrimSpace(line) != "" {
			parsed, parseErr := ParseTraefikLog(line)
			if parseErr == nil && parsed != nil {
				parsedLogs = append(parsedLogs, parsed)
			}
		}
	}

	return LogResult{
		Logs:      parsedLogs,
		Positions: []Position{{Position: int64(len(strContent))}},
	}, nil
}

func readCompressedLogFile(filePath string) (LogResult, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return LogResult{}, err
	}
	defer file.Close()

	gzReader, err := gzip.NewReader(file)
	if err != nil {
		return LogResult{}, err
	}
	defer gzReader.Close()

	content, err := io.ReadAll(gzReader)
	if err != nil {
		return LogResult{}, err
	}

	var parsedLogs []*TraefikLog
	for _, line := range strings.Split(string(content), "\n") {
		if strings.TrimSpace(line) != "" {
			parsed, parseErr := ParseTraefikLog(line)
			if parseErr == nil && parsed != nil {
				parsedLogs = append(parsedLogs, parsed)
			}
		}
	}

	return LogResult{
		Logs:      parsedLogs,
		Positions: []Position{{Position: 0}},
	}, nil
}

func GetDirectoryLogs(dirPath string, positions []Position, isErrorLog bool, includeCompressed bool) (LogResult, error) {
	return getDirectoryLogsWithLimit(dirPath, positions, isErrorLog, includeCompressed, 1000)
}

func getDirectoryLogsWithLimit(dirPath string, positions []Position, isErrorLog bool, includeCompressed bool, tailLines int) (LogResult, error) {
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return LogResult{}, fmt.Errorf("failed to read directory: %w", err)
	}

	var logFiles []string
	for _, entry := range entries {
		fileName := entry.Name()
		isLogFile := strings.HasSuffix(fileName, ".log")
		isGzipFile := strings.HasSuffix(fileName, ".gz")

		if (isLogFile || (isGzipFile && includeCompressed)) &&
			(isErrorLog && strings.Contains(fileName, "error") || !isErrorLog && !strings.Contains(fileName, "error")) {
			logFiles = append(logFiles, fileName)
		}
	}

	// PERFORMANCE FIX: Use sort.Strings (O(n log n)) instead of bubble sort (O(n²))
	sort.Strings(logFiles)

	if len(logFiles) == 0 {
		return LogResult{Logs: []*TraefikLog{}, Positions: []Position{}}, nil
	}

	posMap := make(map[string]int64)
	for _, pos := range positions {
		if pos.Filename != "" {
			posMap[pos.Filename] = pos.Position
		}
	}

	// PERFORMANCE FIX: Pre-allocate slices with estimated capacity
	allLogs := make([]*TraefikLog, 0, 1000)
	newPositions := make([]Position, 0, len(logFiles))

	// If no positions provided, read last file with tail mode
	if len(positions) == 0 && len(logFiles) > 0 {
		lastFile := logFiles[len(logFiles)-1]
		fullPath := filepath.Join(dirPath, lastFile)
		result, err := tailLogFile(fullPath, tailLines)
		if err == nil {
			return result, nil
		}
	}

	for _, fileName := range logFiles {
		fullPath := filepath.Join(dirPath, fileName)
		position := posMap[fileName]

		result, err := getLogWithLimit(fullPath, position, tailLines)
		if err != nil {
			logger.Log.Printf("Error reading log file %s: %v", fileName, err)
			continue
		}

		allLogs = append(allLogs, result.Logs...)

		if len(result.Positions) > 0 {
			newPos := result.Positions[0]
			newPos.Filename = fileName
			newPositions = append(newPositions, newPos)
		}
	}

	return LogResult{
		Logs:      allLogs,
		Positions: newPositions,
	}, nil
}

// GetLogSizes analyzes log files and returns their sizes
func GetLogSizes(path string) (*LogSizesResult, error) {
	fileInfo, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("path error: %w", err)
	}

	var files []LogFileSize
	var summary LogFilesSummary

	// If it's a directory, analyze all files in it
	if fileInfo.IsDir() {
		entries, err := os.ReadDir(path)
		if err != nil {
			return nil, fmt.Errorf("failed to read directory: %w", err)
		}

		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}

			info, err := entry.Info()
			if err != nil {
				continue
			}

			fileName := entry.Name()
			fileSize := info.Size()
			extension := filepath.Ext(fileName)

			// Track file
			files = append(files, LogFileSize{
				Name:      fileName,
				Size:      fileSize,
				Extension: extension,
			})

			// Update summary
			summary.TotalSize += fileSize
			summary.TotalFiles++

			if extension == ".log" {
				summary.LogFilesSize += fileSize
				summary.LogFilesCount++
			} else if extension == ".gz" {
				summary.CompressedFilesSize += fileSize
				summary.CompressedFilesCount++
			}
		}
	} else {
		// Single file
		fileName := filepath.Base(path)
		fileSize := fileInfo.Size()
		extension := filepath.Ext(fileName)

		files = append(files, LogFileSize{
			Name:      fileName,
			Size:      fileSize,
			Extension: extension,
		})

		summary.TotalSize = fileSize
		summary.TotalFiles = 1

		if extension == ".log" {
			summary.LogFilesSize = fileSize
			summary.LogFilesCount = 1
		} else if extension == ".gz" {
			summary.CompressedFilesSize = fileSize
			summary.CompressedFilesCount = 1
		}
	}

	return &LogSizesResult{
		Files:   files,
		Summary: summary,
	}, nil
}
