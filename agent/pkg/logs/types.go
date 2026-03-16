package logs

// Position represents a file position for incremental reading
type Position struct {
	Position int64  `json:"position"`
	Filename string `json:"filename,omitempty"`
}

// LogResult represents the result of reading logs
type LogResult struct {
	Logs      []*TraefikLog `json:"logs"`
	Positions []Position    `json:"positions"`
}

// LogFileSize represents information about a log file
type LogFileSize struct {
	Name      string `json:"name"`
	Size      int64  `json:"size"`
	Extension string `json:"extension"`
}

// LogFilesSummary represents summary statistics for log files
type LogFilesSummary struct {
	TotalSize            int64 `json:"total_size"`
	LogFilesSize         int64 `json:"log_files_size"`
	CompressedFilesSize  int64 `json:"compressed_files_size"`
	TotalFiles           int   `json:"total_files"`
	LogFilesCount        int   `json:"log_files_count"`
	CompressedFilesCount int   `json:"compressed_files_count"`
}

// LogSizesResult represents the result of analyzing log file sizes
type LogSizesResult struct {
	Files   []LogFileSize   `json:"files"`
	Summary LogFilesSummary `json:"summary"`
}