import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV !== "production";
const isLocalhost = (req) =>
  req.ip === "127.0.0.1" ||
  req.ip === "::1" ||
  req.ip === "::ffff:127.0.0.1" ||
  req.hostname === "localhost";

// General API rate limiter (generous in development so testing is never blocked)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50000 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isDev || isLocalhost(req),
  message: {
    error: "Too many requests from this IP address. Please try again after 15 minutes.",
  },
  statusCode: 429,
});

// Strict Auth rate limiter for Login/Register
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isDev || isLocalhost(req),
  message: {
    error: "Too many authentication attempts. Please try again after 15 minutes.",
  },
  statusCode: 429,
});

// Password reset rate limiter
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 500 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isDev || isLocalhost(req),
  message: {
    error: "Too many password reset requests. Please try again after 1 hour.",
  },
  statusCode: 429,
});
