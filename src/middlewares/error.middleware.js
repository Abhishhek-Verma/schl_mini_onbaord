import { logErrorDetails } from "./logger.middleware.js";

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Log rich error details (stack trace, request body, URL, IP, User ID) to logs/error.log
  logErrorDetails(err, req, statusCode);

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}
