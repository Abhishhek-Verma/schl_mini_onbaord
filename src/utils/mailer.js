import { Resend } from "resend";
import { config } from "../config/env.js";

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;
const fromEmail = config.emailFrom;
const appUrl = config.appUrl;

export async function sendVerificationEmail({ email, otp, token }) {
  const magicLink = `${appUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
  const subject = "Verify Your Account - PrismaAuth";

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 30px; border-radius: 12px; border: 1px solid #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <h2 style="color: #6366f1; margin: 0; font-size: 24px;">Prisma<span style="color: #38bdf8;">Auth</span></h2>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 5px;">Email Verification Request</p>
      </div>

      <div style="background: #1e293b; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 25px;">
        <p style="color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: bold;">Your 6-Digit Verification Code</p>
        <h1 style="font-family: monospace; font-size: 36px; color: #38bdf8; letter-spacing: 6px; margin: 0;">${otp}</h1>
        <p style="color: #64748b; font-size: 12px; margin-top: 10px;">Expires in 15 minutes</p>
      </div>

      <div style="text-align: center; margin-bottom: 25px;">
        <p style="color: #cbd5e1; font-size: 14px;">Or click the button below to verify automatically:</p>
        <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #06b6d4); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 14px; margin-top: 10px;">Verify Account Now →</a>
      </div>

      <hr style="border: 0; border-top: 1px solid #334155; margin: 25px 0;" />
      <p style="color: #64748b; font-size: 12px; text-align: center;">If you didn't create an account, you can safely ignore this email.</p>
    </div>
  `;

  if (resend) {
    try {
      await resend.emails.send({
        from: fromEmail,
        to: email,
        subject,
        html: htmlContent,
      });
      console.log(`[RESEND] Verification email sent to ${email}`);
    } catch (err) {
      console.error(`[RESEND ERROR] Failed to send email to ${email}:`, err.message);
    }
  } else {
    console.log("\n=======================================================");
    console.log(`📧 [EMAIL MOCK - RESEND API KEY MISSING]`);
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`OTP Code: ${otp}`);
    console.log(`Magic Link: ${magicLink}`);
    console.log("=======================================================\n");
  }
}

export async function sendPasswordResetEmail({ email, otp, token }) {
  const magicLink = `${appUrl}/magic-login?token=${token}`;
  const subject = "Sign In to Account - PrismaAuth";

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #ffffff; color: #111827; padding: 32px; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
      <div style="text-align: center; margin-bottom: 24px;">
        <p style="font-size: 15px; color: #374151; font-weight: 500; margin-bottom: 16px;">
          Click the button below to finish signing in. This link expires in 60 minutes.
        </p>
        <a href="${magicLink}" style="display: inline-block; background: #000000; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; margin-bottom: 24px;">
          Sign in
        </a>
      </div>

      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

      <div style="background: #f9fafb; padding: 16px; border-radius: 8px; text-align: center;">
        <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 700;">Alternative 6-Digit Reset OTP Code</p>
        <h2 style="font-family: monospace; font-size: 28px; color: #4f46e5; letter-spacing: 4px; margin: 0;">${otp}</h2>
        <p style="color: #9ca3af; font-size: 11px; margin-top: 6px;">Use code on recovery screen to set a new password</p>
      </div>
    </div>
  `;

  if (resend) {
    try {
      await resend.emails.send({
        from: fromEmail,
        to: email,
        subject,
        html: htmlContent,
      });
      console.log(`[RESEND] Password reset email sent to ${email}`);
    } catch (err) {
      console.error(`[RESEND ERROR] Failed to send password reset email to ${email}:`, err.message);
    }
  } else {
    console.log("\n=======================================================");
    console.log(`🔑 [EMAIL MOCK - RESEND API KEY MISSING]`);
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Reset OTP Code: ${otp}`);
    console.log(`Magic Link: ${magicLink}`);
    console.log("=======================================================\n");
  }
}
