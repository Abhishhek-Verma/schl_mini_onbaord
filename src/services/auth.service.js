import crypto from "crypto";
import { prisma } from "../../lib/prisma.js";
import { hashPassword, comparePassword } from "../utils/hash.js";
import { generateAccessToken, generateRefreshTokenPayload, verifyRefreshToken } from "../utils/jwt.js";
import { verifyGoogleToken } from "../utils/google.js";
import { config } from "../config/env.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../utils/mailer.js";

function generate6DigitOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const ASSIGNABLE_ROLES = ["USER", "ADMIN", "TEACHER", "PRINCIPAL"];

async function createSession(user, req = null) {
  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  };

  const accessToken = generateAccessToken(payload);
  const refreshTokenString = generateRefreshTokenPayload(payload);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (config.refreshTokenExpiresInDays || 7));

  // Parse device metadata from request if available
  let deviceData = {};
  if (req) {
    const { parseUserAgent } = await import("./session.service.js");
    const ua = req.headers?.["user-agent"] || null;
    const parsed = parseUserAgent(ua);
    deviceData = {
      ipAddress: req.ip || req.socket?.remoteAddress || null,
      userAgent: ua,
      deviceName: parsed.deviceName,
      browser: parsed.browser,
      os: parsed.os,
    };
  }

  await prisma.refreshToken.create({
    data: {
      token: refreshTokenString,
      userId: user.id,
      expiresAt,
      ...deviceData,
    },
  });

  let onboardingCompleted = false;
  let demoClassCompleted = false;
  let demoVideoUrl = null;
  let pedagogyCompleted = false;
  let subjectAssessmentCompleted = false;
  let skillAssessmentCompleted = false;
  if (user.role === "TEACHER") {
    const tp = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
      select: {
        onboardingCompleted: true,
        demoClassCompleted: true,
        demoVideoUrl: true,
        pedagogyCompleted: true,
        subjectAssessmentCompleted: true,
        skillAssessmentCompleted: true,
      },
    });
    onboardingCompleted = tp?.onboardingCompleted || false;
    const hasDemoUrl = Boolean(tp?.demoVideoUrl && tp.demoVideoUrl.trim().length > 0);
    demoClassCompleted = hasDemoUrl || Boolean(tp?.demoClassCompleted);
    demoVideoUrl = tp?.demoVideoUrl || null;
    pedagogyCompleted = Boolean(tp?.pedagogyCompleted);
    subjectAssessmentCompleted = Boolean(tp?.subjectAssessmentCompleted);
    skillAssessmentCompleted = Boolean(tp?.skillAssessmentCompleted);
  } else if (user.role === "PRINCIPAL") {
    const pp = await prisma.principalProfile.findUnique({
      where: { userId: user.id },
      select: { onboardingCompleted: true },
    });
    onboardingCompleted = pp?.onboardingCompleted || false;
  }

  const { password: _, resetToken: __, resetTokenExpiry: ___, verificationOTP: ____, resetOTP: _____, ...userWithoutSecrets } = user;

  return {
    user: {
      ...userWithoutSecrets,
      onboardingCompleted,
      demoClassCompleted,
      demoVideoUrl,
      pedagogyCompleted,
      subjectAssessmentCompleted,
      skillAssessmentCompleted,
    },
    accessToken,
    refreshToken: refreshTokenString,
  };
}

export async function registerUser({ username, email, password, displayName, phoneNumber, role }, req = null) {
  if (!username || !email || !password) {
    const error = new Error("Username, email, and password are required");
    error.statusCode = 400;
    throw error;
  }

  const cleanPhone = phoneNumber ? phoneNumber.trim() : null;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { username },
        ...(cleanPhone ? [{ phoneNumber: cleanPhone }] : []),
      ],
    },
  });

  if (existingUser) {
    let field = "username";
    if (existingUser.email === email) field = "email";
    if (cleanPhone && existingUser.phoneNumber === cleanPhone) field = "phone number";
    const error = new Error(`User with this ${field} already exists`);
    error.statusCode = 400;
    throw error;
  }

  const hashedPassword = await hashPassword(password);
  const verificationOTP = generate6DigitOTP();
  const verificationOTPExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      displayName: displayName || username,
      phoneNumber: cleanPhone,
      role: role && ASSIGNABLE_ROLES.includes(role) ? role : "USER",
      isEmailVerified: false,
      verificationOTP,
      verificationOTPExpiry,
    },
  });

  // Send verification email via Resend
  await sendVerificationEmail({ email, otp: verificationOTP, token: user.id });

  return createSession(user, req);
}

export async function loginUser({ identifier, password }, req = null) {
  if (!identifier || !password) {
    const error = new Error("Username/Email and password are required");
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
    },
  });

  if (!user || !user.password) {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  return createSession(user, req);
}

export async function verifyUserEmail({ email, otp, token }) {
  if (!email && !token) {
    const error = new Error("Email or verification token is required");
    error.statusCode = 400;
    throw error;
  }

  let user;

  if (token) {
    user = await prisma.user.findUnique({ where: { id: token } });
  } else if (email) {
    user = await prisma.user.findUnique({ where: { email } });
  }

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  if (user.isEmailVerified) {
    return { message: "Email is already verified", isEmailVerified: true };
  }

  // Verify OTP if provided
  if (otp) {
    if (user.verificationOTP !== otp || (user.verificationOTPExpiry && user.verificationOTPExpiry < new Date())) {
      const error = new Error("Invalid or expired 6-digit verification code");
      error.statusCode = 400;
      throw error;
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      verificationOTP: null,
      verificationOTPExpiry: null,
    },
  });

  return { message: "Email verified successfully!", isEmailVerified: true };
}

export async function resendUserVerification({ email }) {
  if (!email) {
    const error = new Error("Email is required");
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  if (user.isEmailVerified) {
    return { message: "Email is already verified" };
  }

  const verificationOTP = generate6DigitOTP();
  const verificationOTPExpiry = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationOTP,
      verificationOTPExpiry,
    },
  });

  await sendVerificationEmail({ email, otp: verificationOTP, token: user.id });

  return { message: "Verification code sent to your email." };
}

export async function googleAuthUser({ idToken, accessToken }, req = null) {
  const googleUser = await verifyGoogleToken({ idToken, accessToken });

  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { googleId: googleUser.googleId },
        { email: googleUser.email },
      ],
    },
  });

  const googleAvatar = googleUser.picture || null;

  if (!user) {
    const baseUsername = (googleUser.email.split("@")[0] || "user").replace(/[^a-zA-Z0-9]/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const username = `${baseUsername}_${randomSuffix}`;

    user = await prisma.user.create({
      data: {
        googleId: googleUser.googleId,
        email: googleUser.email,
        username,
        displayName: googleUser.name,
        avatar: googleAvatar,
        isEmailVerified: true, // Google OAuth emails are verified by Google
      },
    });
  } else {
    // Ensure existing accounts linking to Google set isEmailVerified: true
    // And sync the Google avatar if available, or keep existing avatar
    const updatedAvatar = googleAvatar || user.avatar;
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: googleUser.googleId,
        avatar: updatedAvatar,
        isEmailVerified: true,
      },
    });
  }

  return createSession(user, req);
}

export async function assignUserRole({ userId, role }, req = null) {
  if (!ASSIGNABLE_ROLES.includes(role)) {
    const error = new Error("Choose a valid role: USER, ADMIN, TEACHER, or PRINCIPAL");
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  if (user.role) {
    const error = new Error("A role has already been assigned to this account");
    error.statusCode = 409;
    throw error;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  return createSession(updatedUser, req);
}

export async function checkAccountStatus({ email }) {
  if (!email) {
    const error = new Error("Email is required");
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { exists: false };
  }

  const provider = user.googleId && !user.password ? "GOOGLE" : user.googleId && user.password ? "BOTH" : "PASSWORD";

  return {
    exists: true,
    provider,
    isEmailVerified: user.isEmailVerified,
    displayName: user.displayName || user.username,
  };
}

export async function refreshSessionToken({ refreshToken }) {
  if (!refreshToken) {
    const error = new Error("Refresh token required");
    error.statusCode = 400;
    throw error;
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    const error = new Error("Invalid or expired refresh token");
    error.statusCode = 403;
    throw error;
  }

  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { User: true },
  });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    if (storedToken) {
      await prisma.refreshToken.delete({ where: { token: refreshToken } });
    }
    const error = new Error("Refresh token expired or revoked");
    error.statusCode = 403;
    throw error;
  }

  const payload = {
    id: storedToken.User.id,
    email: storedToken.User.email,
    username: storedToken.User.username,
    role: storedToken.User.role,
  };

  // Update last used timestamp for Active Sessions tracking
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { lastUsedAt: new Date() },
  });

  const newAccessToken = generateAccessToken(payload);
  return { accessToken: newAccessToken };
}

export async function logoutUser({ refreshToken }) {
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }
  return { message: "Logged out successfully" };
}

export async function magicLoginUser({ token }, req = null) {
  if (!token) {
    const error = new Error("Magic link token is required");
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    const error = new Error("Invalid or expired Magic Link");
    error.statusCode = 400;
    throw error;
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: null,
      resetTokenExpiry: null,
      resetOTP: null,
      resetOTPExpiry: null,
      isEmailVerified: true,
    },
  });

  return createSession(updatedUser, req);
}

export async function verifyResetOTP({ email, otp }) {
  if (!email || !otp) {
    const error = new Error("Email and 6-digit OTP code are required");
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findFirst({
    where: {
      email,
      resetOTP: otp,
      resetOTPExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    const error = new Error("Invalid or expired 6-digit OTP code");
    error.statusCode = 400;
    throw error;
  }

  return { valid: true, message: "OTP code verified successfully" };
}

export async function requestPasswordReset({ email }) {
  if (!email) {
    const error = new Error("Email is required");
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const error = new Error("No registered account found with this email address");
    error.statusCode = 404;
    throw error;
  }

  const resetToken = crypto.randomUUID();
  const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
  const resetOTP = generate6DigitOTP();
  const resetOTPExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken,
      resetTokenExpiry,
      resetOTP,
      resetOTPExpiry,
    },
  });

  // Send Resend password reset email with OTP & Magic Link
  await sendPasswordResetEmail({ email, otp: resetOTP, token: resetToken });

  return {
    message: "Password reset OTP and Magic Link sent to your email.",
    resetToken,
    resetOTP,
  };
}

export async function resetPassword({ token, otp, email, newPassword }) {
  if (!newPassword) {
    const error = new Error("New password is required");
    error.statusCode = 400;
    throw error;
  }

  if (!token && (!otp || !email)) {
    const error = new Error("Provide either a reset token (magic link) or email + 6-digit OTP");
    error.statusCode = 400;
    throw error;
  }

  let user;

  if (token) {
    user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });
  } else if (otp && email) {
    user = await prisma.user.findFirst({
      where: {
        email,
        resetOTP: otp,
        resetOTPExpiry: { gt: new Date() },
      },
    });
  }

  if (!user) {
    const error = new Error("Invalid or expired reset token / OTP code");
    error.statusCode = 400;
    throw error;
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
      resetOTP: null,
      resetOTPExpiry: null,
      isEmailVerified: true,
    },
  });

  // Revoke all existing sessions
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  return { message: "Password updated successfully. Please log in with your new password." };
}

export async function changeUserPassword({ userId, oldPassword, newPassword }) {
  if (!newPassword) {
    const error = new Error("New password is required");
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  if (user.password) {
    if (!oldPassword) {
      const error = new Error("Current password is required");
      error.statusCode = 400;
      throw error;
    }
    const isPasswordValid = await comparePassword(oldPassword, user.password);
    if (!isPasswordValid) {
      const error = new Error("Incorrect current password");
      error.statusCode = 400;
      throw error;
    }
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return { message: user.password ? "Password changed successfully" : "Password set successfully" };
}

export async function getUserProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      phoneNumber: true,
      avatar: true,
      role: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true,
      teacherProfile: {
        select: {
          onboardingCompleted: true,
          basicInformationCompleted: true,
          profileCompletionCompleted: true,
          documentsCompleted: true,
          pedagogyCompleted: true,
          subjectAssessmentCompleted: true,
          skillAssessmentCompleted: true,
          demoClassCompleted: true,
          demoVideoUrl: true,
          passportScoreCompleted: true,
          availabilityCompleted: true,
          openToSubjects: true,
          openToClasses: true,
          openToBoard: true,
        },
      },
      principalProfile: {
        select: {
          onboardingCompleted: true,
          basicInformationCompleted: true,
          profileCompletionCompleted: true,
          documentsCompleted: true,
          verificationStatus: true,
        },
      },
    },
  });

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const { teacherProfile, principalProfile, ...userData } = user;
  const onboardingCompleted =
    user.role === "TEACHER"
      ? teacherProfile?.onboardingCompleted || false
      : user.role === "PRINCIPAL"
      ? principalProfile?.onboardingCompleted || false
      : false;

  const hasDemoUrl = Boolean(teacherProfile?.demoVideoUrl && teacherProfile.demoVideoUrl.trim().length > 0);
  const demoClassCompleted = hasDemoUrl || Boolean(teacherProfile?.demoClassCompleted);

  return {
    ...userData,
    onboardingCompleted,
    demoClassCompleted,
    demoVideoUrl: teacherProfile?.demoVideoUrl || null,
    pedagogyCompleted: Boolean(teacherProfile?.pedagogyCompleted),
    subjectAssessmentCompleted: Boolean(teacherProfile?.subjectAssessmentCompleted),
    skillAssessmentCompleted: Boolean(teacherProfile?.skillAssessmentCompleted),
    teacherProfile: teacherProfile || null,
    principalProfile: principalProfile || null,
  };
}

export async function updateUserProfile({ userId, displayName, avatar, phoneNumber }) {
  const dataToUpdate = {};

  if (displayName !== undefined) {
    if (typeof displayName !== "string" || !displayName.trim()) {
      const error = new Error("Display name must be a non-empty string");
      error.statusCode = 400;
      throw error;
    }
    dataToUpdate.displayName = displayName.trim();
  }

  if (avatar !== undefined) {
    dataToUpdate.avatar = avatar ? avatar.trim() : null;
  }

  if (phoneNumber !== undefined) {
    dataToUpdate.phoneNumber = phoneNumber ? phoneNumber.trim() : null;
  }

  if (Object.keys(dataToUpdate).length === 0) {
    const error = new Error("No valid fields provided to update (displayName, avatar, phoneNumber)");
    error.statusCode = 400;
    throw error;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: dataToUpdate,
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      phoneNumber: true,
      avatar: true,
      role: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
}

