import { Router } from "express";
import {
  getSessionsHandler,
  revokeSessionHandler,
  revokeAllSessionsHandler,
} from "../controllers/session.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";

const router = Router();

// All session routes require authentication
router.get("/", authenticateToken, getSessionsHandler);
router.delete("/:sessionId", authenticateToken, revokeSessionHandler);
router.delete("/", authenticateToken, revokeAllSessionsHandler);

export default router;
