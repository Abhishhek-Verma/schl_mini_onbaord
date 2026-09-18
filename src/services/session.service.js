import { prisma } from "../../lib/prisma.js";

/**
 * Parse user-agent string into human-readable device info.
 * Extracts browser name, OS, and generates a friendly device label.
 */
export function parseUserAgent(ua) {
  if (!ua) return { browser: "Unknown", os: "Unknown", deviceName: "Unknown Device" };

  let browser = "Unknown";
  let os = "Unknown";

  // Detect browser
  if (ua.includes("Edg/")) browser = "Microsoft Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Brave")) browser = "Brave";
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("MSIE") || ua.includes("Trident/")) browser = "Internet Explorer";

  // Detect OS
  if (ua.includes("Windows NT 10")) os = "Windows 10/11";
  else if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Mac OS X") || ua.includes("Macintosh")) os = "macOS";
  else if (ua.includes("iPhone")) os = "iPhone (iOS)";
  else if (ua.includes("iPad")) os = "iPad (iPadOS)";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("CrOS")) os = "Chrome OS";

  const deviceName = `${browser} on ${os}`;

  return { browser, os, deviceName };
}

/**
 * Get all active sessions for a user (non-expired refresh tokens).
 */
export async function getActiveSessions(userId, currentRefreshToken) {
  const sessions = await prisma.refreshToken.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      ipAddress: true,
      deviceName: true,
      browser: true,
      os: true,
      token: true,
    },
    orderBy: { lastUsedAt: "desc" },
  });

  return sessions.map((session) => ({
    id: session.id,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    ipAddress: session.ipAddress || "Unknown",
    deviceName: session.deviceName || "Unknown Device",
    browser: session.browser || "Unknown",
    os: session.os || "Unknown",
    isCurrent: session.token === currentRefreshToken,
  }));
}

/**
 * Revoke a specific session by its ID (must belong to the same user).
 */
export async function revokeSession(userId, sessionId) {
  const session = await prisma.refreshToken.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) {
    const error = new Error("Session not found");
    error.statusCode = 404;
    throw error;
  }

  await prisma.refreshToken.delete({ where: { id: sessionId } });

  return { message: "Session revoked successfully" };
}

/**
 * Revoke all sessions except the current one.
 */
export async function revokeAllOtherSessions(userId, currentRefreshToken) {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      userId,
      token: { not: currentRefreshToken },
    },
  });

  return {
    message: `${result.count} other session(s) revoked successfully`,
    revokedCount: result.count,
  };
}
