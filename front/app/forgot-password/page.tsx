'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { Mail, ArrowRight, CheckCircle2, AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [screen, setScreen] = useState<'EMAIL_INPUT' | 'EMAIL_SENT' | 'ENTER_OTP'>('EMAIL_INPUT');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);

  // OTP Verification & Password Reset fields
  const [otp, setOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Step 1: Validate Email & Send Recovery Email
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);

    try {
      await fetchApi('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      setScreen('EMAIL_SENT');
    } catch (err: any) {
      setError(err.message || 'No account found with this email address.');
    } finally {
      setLoading(false);
    }
  };

  // Resend Email Handler
  const handleResendEmail = async () => {
    setLoading(true);
    setError(null);
    setResendSuccess(false);

    try {
      await fetchApi('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to resend email');
    } finally {
      setLoading(false);
    }
  };

  // Step A: Verify 6-Digit OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP code.');
      return;
    }

    setVerifyingOtp(true);
    setError(null);

    try {
      await fetchApi('/auth/verify-reset-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      });

      setOtpVerified(true);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired 6-digit OTP code.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Step B: Reset Password after OTP is Verified
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please check your new password.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setResetLoading(true);

    try {
      await fetchApi('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          otp,
          newPassword,
        }),
      });

      setResetSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12">
      <div className="bg-card text-card-foreground border border-border rounded-xl p-6 md:p-8 shadow-xl">
        {error && (
          <div className="bg-destructive/15 border border-destructive text-destructive rounded-md p-3 text-sm mb-5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {resendSuccess && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-md p-3 text-sm mb-5 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Recovery email dispatched to your inbox!
          </div>
        )}

        {/* SCREEN 1: Enter Email */}
        {screen === 'EMAIL_INPUT' && (
          <div>
            <div className="mb-6">
              <h2 className="font-heading text-2xl font-bold">Reset Password</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Enter your email address to verify user account
              </p>
            </div>

            <form onSubmit={handleSendEmail} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Enter Email
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="flex-1 px-3.5 py-2.5 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-md border border-primary cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                  >
                    {loading ? 'Validating...' : 'Send'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* SCREEN 2: Email Sent Prompt */}
        {screen === 'EMAIL_SENT' && (
          <div className="text-center py-2">
            <div className="w-14 h-14 bg-cyan-500/10 border border-cyan-500/30 rounded-md flex items-center justify-center mx-auto mb-5">
              <Mail className="w-7 h-7 text-cyan-500" />
            </div>

            <p className="text-muted-foreground text-sm mb-1">
              To continue, click the link sent to
            </p>
            <p className="text-base font-bold text-foreground mb-6 break-all">
              {email}
            </p>

            <div className="flex flex-col gap-3 items-center">
              <button
                type="button"
                onClick={() => { setScreen('ENTER_OTP'); setError(null); }}
                className="bg-transparent border-0 text-primary text-sm font-semibold cursor-pointer underline"
              >
                Enter verification code
              </button>

              <button
                type="button"
                onClick={handleResendEmail}
                disabled={loading}
                className="bg-transparent border-0 text-muted-foreground hover:text-foreground text-xs cursor-pointer"
              >
                Resend email
              </button>

              <button
                type="button"
                onClick={() => { setScreen('EMAIL_INPUT'); setError(null); setOtpVerified(false); setOtp(''); }}
                className="bg-transparent border-0 text-muted-foreground/60 hover:text-muted-foreground text-xs cursor-pointer"
              >
                Use a different email
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 3: 2-Step OTP Verification & Password Reset */}
        {screen === 'ENTER_OTP' && (
          <div>
            <div className="flex items-center gap-2 mb-5">
              <button
                type="button"
                onClick={() => { setScreen('EMAIL_SENT'); setError(null); }}
                className="bg-transparent border-0 text-muted-foreground hover:text-foreground cursor-pointer flex items-center p-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="font-heading text-xl font-bold">Verification Code</h2>
            </div>

            {resetSuccess ? (
              <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-md p-5 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <h3 className="font-heading text-lg font-bold text-emerald-400">
                  Password Reset Successful!
                </h3>
                <p className="text-xs text-muted-foreground mt-1 mb-5">
                  Your password has been updated. Please sign in with your new password.
                </p>
                <button
                  onClick={() => router.push('/login')}
                  className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-md border border-primary cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  Proceed to Sign In <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : !otpVerified ? (
              /* STEP A: Enter & Verify OTP First */
              <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Enter 6-Digit Verification OTP
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="e.g. 742373"
                    className="w-full px-3.5 py-3 bg-input border border-border rounded-md text-foreground text-xl tracking-[4px] text-center font-mono focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={verifyingOtp}
                  className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-md border border-primary cursor-pointer transition-colors shadow-sm mt-2 disabled:opacity-50"
                >
                  {verifyingOtp ? 'Verifying OTP...' : 'Verify Code'}
                </button>
              </form>
            ) : (
              /* STEP B: OTP Verified -> Enter New & Confirm Password */
              <div>
                <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-md p-3 text-xs font-semibold mb-5 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" /> Code Verified! Set your new password below.
                </div>

                <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-md border border-primary cursor-pointer transition-colors shadow-sm mt-2 disabled:opacity-50"
                  >
                    {resetLoading ? 'Resetting Password...' : 'Reset Password'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-border text-center">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Remember your password? <span className="text-primary font-semibold">Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
