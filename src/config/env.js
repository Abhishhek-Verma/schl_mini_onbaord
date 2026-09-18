import "dotenv/config";

export const config = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || "super-secret-jwt-key-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || "super-secret-refresh-key-change-in-production",
  refreshTokenExpiresInDays: Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS) || 7,
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "Schoolmini <noreply@schoolmini.com>",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucketName: process.env.R2_BUCKET_NAME || "",
    publicUrl: process.env.R2_PUBLIC_URL || "",
  },
};
