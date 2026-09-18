import { Router } from "express";
import {
  registerHandler,
  loginHandler,
  googleAuthHandler,
  refreshTokenHandler,
  logoutHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  changePasswordHandler,
  getMeHandler,
  checkAccountHandler,
  verifyEmailHandler,
  resendVerificationHandler,
  magicLoginHandler,
  verifyResetOTPHandler,
  updateProfileHandler,
  createAvatarUploadHandler,
  assignRoleHandler,
} from "../controllers/auth.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { authLimiter, passwordResetLimiter } from "../middlewares/rateLimit.middleware.js";

const router = Router();

// Public Auth Endpoints
router.post("/register", authLimiter, registerHandler);
router.post("/login", authLimiter, loginHandler);
router.post("/google", authLimiter, googleAuthHandler);
router.post("/check-account", checkAccountHandler);
router.post("/verify-email", verifyEmailHandler);
router.post("/resend-verification", authLimiter, resendVerificationHandler);
router.post("/magic-login", magicLoginHandler);
router.post("/verify-reset-otp", verifyResetOTPHandler);
router.post("/refresh", refreshTokenHandler);
router.post("/refresh-token", refreshTokenHandler);
router.post("/logout", logoutHandler);
router.post("/forgot-password", passwordResetLimiter, forgotPasswordHandler);
router.post("/reset-password", passwordResetLimiter, resetPasswordHandler);

// Protected Auth Endpoints
router.get("/me", authenticateToken, getMeHandler);
router.post("/role", authenticateToken, assignRoleHandler);
router.patch("/profile", authenticateToken, updateProfileHandler);
router.put("/profile", authenticateToken, updateProfileHandler);
router.post("/profile/avatar-upload", authenticateToken, createAvatarUploadHandler);
router.post("/change-password", authenticateToken, changePasswordHandler);

export default router;
