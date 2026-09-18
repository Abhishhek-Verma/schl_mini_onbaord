import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import apiRoutes from "./routes/index.js";
import { config } from "./config/env.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { apiLimiter } from "./middlewares/rateLimit.middleware.js";
import {
  fileLoggerMiddleware,
  devConsoleLoggerMiddleware,
  errorLogInterceptor,
} from "./middlewares/logger.middleware.js";

const app = express();

// Enable Trust Proxy for rate limiters & client IP detection
app.set("trust proxy", 1);

// HTTP Request & Error Logging
app.use(devConsoleLoggerMiddleware);
app.use(fileLoggerMiddleware);
app.use(errorLogInterceptor);

app.use(express.json());
app.use(cookieParser());

// Dynamic CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [config.appUrl || "http://localhost:3000", "http://127.0.0.1:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
  })
);

// Apply global API Rate Limiter
app.use("/api", apiLimiter);

// API Routes
app.use("/api", apiRoutes);

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// Global Error Handler
app.use(errorHandler);

export default app;
