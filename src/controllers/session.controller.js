import {
  getActiveSessions,
  revokeSession,
  revokeAllOtherSessions,
} from "../services/session.service.js";

export async function getSessionsHandler(req, res, next) {
  try {
    const currentRefreshToken = req.cookies?.refreshToken || req.body?.currentRefreshToken || null;
    const sessions = await getActiveSessions(req.user.id, currentRefreshToken);
    res.json({ sessions, total: sessions.length });
  } catch (error) {
    next(error);
  }
}

export async function revokeSessionHandler(req, res, next) {
  try {
    const { sessionId } = req.params;
    const result = await revokeSession(req.user.id, sessionId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function revokeAllSessionsHandler(req, res, next) {
  try {
    const currentRefreshToken = req.cookies?.refreshToken || req.body?.currentRefreshToken || null;
    const result = await revokeAllOtherSessions(req.user.id, currentRefreshToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
