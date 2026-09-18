import crypto from "node:crypto";
import {
  registerUser,
  loginUser,
  googleAuthUser,
  refreshSessionToken,
  logoutUser,
  requestPasswordReset,
  resetPassword,
  changeUserPassword,
  getUserProfile,
  checkAccountStatus,
  verifyUserEmail,
  resendUserVerification,
  magicLoginUser,
  verifyResetOTP,
  updateUserProfile,
  assignUserRole,
} from "../services/auth.service.js";
import { setRefreshTokenCookie, clearRefreshTokenCookie } from "../utils/cookie.js";
import { generatePresignedUploadUrl, getR2PublicUrl } from "../utils/r2.js";

export async function registerHandler(req, res, next) {
  try {
    const result = await registerUser(req.body, req);
    if (result.refreshToken) {
      setRefreshTokenCookie(res, result.refreshToken);
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function loginHandler(req, res, next) {
  try {
    const result = await loginUser(req.body, req);
    if (result.refreshToken) {
      setRefreshTokenCookie(res, result.refreshToken);
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function googleAuthHandler(req, res, next) {
  try {
    const result = await googleAuthUser(req.body, req);
    if (result.refreshToken) {
      setRefreshTokenCookie(res, result.refreshToken);
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function assignRoleHandler(req, res, next) {
  try {
    const result = await assignUserRole({ userId: req.user.id, role: req.body.role }, req);
    if (result.refreshToken) {
      setRefreshTokenCookie(res, result.refreshToken);
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function checkAccountHandler(req, res, next) {
  try {
    const { email } = req.body;
    const result = await checkAccountStatus({ email });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function verifyEmailHandler(req, res, next) {
  try {
    const { email, otp, token } = req.body;
    const result = await verifyUserEmail({ email, otp, token });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function resendVerificationHandler(req, res, next) {
  try {
    const { email } = req.body;
    const result = await resendUserVerification({ email });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function magicLoginHandler(req, res, next) {
  try {
    const { token } = req.body;
    const result = await magicLoginUser({ token }, req);
    if (result.refreshToken) {
      setRefreshTokenCookie(res, result.refreshToken);
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function verifyResetOTPHandler(req, res, next) {
  try {
    const { email, otp } = req.body;
    const result = await verifyResetOTP({ email, otp });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function refreshTokenHandler(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    const result = await refreshSessionToken({ refreshToken });
    if (result.refreshToken) {
      setRefreshTokenCookie(res, result.refreshToken);
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function logoutHandler(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    const result = await logoutUser({ refreshToken });
    clearRefreshTokenCookie(res);
    res.json(result);
  } catch (error) {
    clearRefreshTokenCookie(res);
    next(error);
  }
}

export async function forgotPasswordHandler(req, res, next) {
  try {
    const { email } = req.body;
    const result = await requestPasswordReset({ email });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function resetPasswordHandler(req, res, next) {
  try {
    const { token, otp, email, newPassword } = req.body;
    const result = await resetPassword({ token, otp, email, newPassword });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function changePasswordHandler(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;
    const result = await changeUserPassword({
      userId: req.user.id,
      oldPassword,
      newPassword,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getMeHandler(req, res, next) {
  try {
    const profile = await getUserProfile(req.user.id);
    res.json(profile);
  } catch (error) {
    next(error);
  }
}

export async function updateProfileHandler(req, res, next) {
  try {
    const { displayName, avatar, phoneNumber } = req.body;
    const updatedProfile = await updateUserProfile({
      userId: req.user.id,
      displayName,
      avatar,
      phoneNumber,
    });
    res.json(updatedProfile);
  } catch (error) {
    next(error);
  }
}

export async function createAvatarUploadHandler(req, res, next) {
  try {
    const { contentType } = req.body;
    const allowedContentTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

    if (!allowedContentTypes.includes(contentType)) {
      return res.status(400).json({ error: "Avatar must be a JPEG, PNG, WEBP, or GIF image" });
    }

    const extension = contentType.split("/")[1].replace("jpeg", "jpg");
    const storageKey = `avatars/${req.user.id}/${crypto.randomUUID()}.${extension}`;
    const uploadUrl = await generatePresignedUploadUrl({
      storageKey,
      mimeType: contentType,
    });

    res.json({ uploadUrl, avatarUrl: getR2PublicUrl(storageKey) });
  } catch (error) {
    next(error);
  }
}

