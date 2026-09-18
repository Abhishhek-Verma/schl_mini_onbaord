import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config } from "../config/env.js";

export function generateAccessToken(payload) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export function generateRefreshTokenPayload(payload) {
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    config.refreshTokenSecret,
    {
      expiresIn: `${config.refreshTokenExpiresInDays}d`,
    }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, config.refreshTokenSecret);
}
