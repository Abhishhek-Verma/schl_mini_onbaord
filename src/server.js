import app from "./app.js";
import { config } from "./config/env.js";
import { recoverStrandedJobs } from "./services/demoEvaluation.service.js";

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
});

const server = app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
  // Initial recovery sweep on server startup
  recoverStrandedJobs().catch((err) => console.error("Startup job recovery error:", err.message));
});

// Periodic recovery sweep every 5 minutes
const recoveryInterval = setInterval(() => {
  recoverStrandedJobs().catch((err) => console.error("Periodic sweep error:", err.message));
}, 5 * 60 * 1000);

// Heartbeat to ensure event loop remains active in all terminal runner environments
setInterval(() => {}, 10000);

process.on("SIGINT", () => {
  clearInterval(recoveryInterval);
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

