import app from "./app.js";
import { config } from "./config/env.js";

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
});

const server = app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});

// Heartbeat to ensure event loop remains active in all terminal runner environments
setInterval(() => {}, 10000);

process.on("SIGINT", () => {
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
