// Standalone alert worker for self-hosted deployments
// Starts the background scheduler as a dedicated process

// Use relative imports for easier bundling
import { backgroundScheduler } from "../lib/services/background-scheduler";
import { serviceManager } from "../lib/services/service-manager";
import { initDatabase, syncEnvAgents } from "../lib/db/database";

const globalState = globalThis as unknown as { __alertWorkerStarted?: boolean };

async function startWorker() {
  if (globalState.__alertWorkerStarted) {
    console.warn("[AlertWorker] Worker already running, skipping duplicate start");
    return;
  }

  // Allow overriding interval via ENV for the worker
  const checkInterval = process.env.ALERT_CHECK_INTERVAL
    ? parseInt(process.env.ALERT_CHECK_INTERVAL)
    : 30 * 60 * 1000; // Default 30m

  console.log(`[AlertWorker] Starting Alert Worker Service (Interval: ${checkInterval}ms)`);

  globalState.__alertWorkerStarted = true;

  console.log("[AlertWorker] Initializing database and services...");
  initDatabase();
  syncEnvAgents();
  serviceManager.initialize();

  console.log("[AlertWorker] Starting background scheduler...");

  // Force start the scheduler
  backgroundScheduler.start(checkInterval);

  console.log("[AlertWorker] Worker is running. Press Ctrl+C to exit.");
}

function shutdown() {
  console.log("[AlertWorker] Shutting down...");
  try {
    backgroundScheduler.stop();
    serviceManager.shutdown();
  } catch (error) {
    console.error("[AlertWorker] Error during shutdown:", error);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("unhandledRejection", (reason) => {
  console.error("[AlertWorker] Unhandled rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[AlertWorker] Uncaught exception:", error);
});

startWorker().catch((error) => {
  console.error("[AlertWorker] Failed to start worker:", error);
  process.exit(1);
});
