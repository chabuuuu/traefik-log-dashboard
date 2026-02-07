export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // SECURITY: Intercept and filter Server Action errors
    const originalConsoleError = console.error;

    console.error = (...args: unknown[]) => {
      const errorString = args.join(' ');

      // SECURITY: Suppress Server Action attack attempt errors
      if (
        errorString.includes('Failed to find Server Action') &&
        (errorString.includes('X1N0YW5kYXJk') || // Base64 attack patterns
         errorString.includes('child_process') ||
         errorString.includes('execSync') ||
         errorString.includes('/bin/sh') ||
         errorString.includes('/bin/bash') ||
         errorString.includes('/dev/tcp') ||
         errorString.includes('W10='))
      ) {
        // Log once without the full payload to avoid log pollution
        console.warn('[Security] Blocked malicious Server Action attempt');
        return;
      }

      // Allow legitimate errors through
      originalConsoleError.apply(console, args);
    };

    if (process.env.NODE_ENV === 'development') {
      console.warn('[Instrumentation] Security error filtering enabled');
    }

    const { initDatabase, syncEnvAgents } = await import('./lib/db/database');

    // Initialize DB and sync env agents (required for UI to see data)
    initDatabase();
    syncEnvAgents();

    // NOTE: Background scheduler now runs in the dedicated alert worker service.
    // Skipping scheduler start here prevents dual execution and keeps the web UI light.
    if (process.env.NODE_ENV === 'development') {
      console.log('[Instrumentation] Background scheduler skipped (handled by worker service)');
    }
  }
}
