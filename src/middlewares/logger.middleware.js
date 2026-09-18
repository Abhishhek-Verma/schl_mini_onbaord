import fs from "fs";
import path from "path";
import morgan from "morgan";

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Stream for general HTTP traffic (logs/access.log)
const accessLogStream = fs.createWriteStream(
  path.join(logsDir, "access.log"),
  { flags: "a" }
);

// Stream for detailed error logs (logs/error.log)
const errorLogStream = fs.createWriteStream(
  path.join(logsDir, "error.log"),
  { flags: "a" }
);

morgan.token("date", () => new Date().toISOString());
const logFormat = "[:date] :method :url :status :response-time ms - :remote-addr";

export const fileLoggerMiddleware = morgan(logFormat, {
  stream: accessLogStream,
});

export const devConsoleLoggerMiddleware = morgan("dev");

// Helper to sanitize sensitive fields in request body
function sanitizeBody(body) {
  if (!body || typeof body !== "object") return body;
  const sensitiveKeys = [
    "password",
    "oldPassword",
    "newPassword",
    "confirmPassword",
    "token",
    "resetToken",
    "otp",
    "accessToken",
    "refreshToken",
  ];

  const sanitized = { ...body };
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.includes(key)) {
      sanitized[key] = "[REDACTED]";
    }
  }
  return sanitized;
}

// Log rich detailed error to logs/error.log
export function logErrorDetails(err, req, statusCode) {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;
  const ip = req.ip || req.socket.remoteAddress || "UNKNOWN";
  const userId = req.user?.id || "ANONYMOUS";
  const sanitizedBody = sanitizeBody(req.body);

  const errorLogEntry = `
================================================================================
[${timestamp}] HTTP ${statusCode} ERROR
Path: ${method} ${url}
User ID: ${userId} | Client IP: ${ip}
Error Message: ${err.message || "Unknown Error"}
Request Body: ${JSON.stringify(sanitizedBody, null, 2)}
${err.stack ? `Stack Trace:\n${err.stack}\n` : ""}================================================================================
`;

  errorLogStream.write(errorLogEntry);
}

// Express Middleware to intercept ALL HTTP errors (400-599) automatically
export function errorLogInterceptor(req, res, next) {
  const originalJson = res.json;

  res.json = function (body) {
    if (res.statusCode >= 400) {
      logErrorDetails(
        {
          message: body?.error || body?.message || "HTTP Error Response",
          stack: body?.stack || null,
        },
        req,
        res.statusCode
      );
    }
    return originalJson.call(this, body);
  };

  next();
}
