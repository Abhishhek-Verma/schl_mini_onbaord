'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { KeyRound, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<'OTP' | 'TOKEN'>('OTP');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    const otpParam = searchParams.get('otp');
    const emailParam = searchParams.get('email');

    if (emailParam) setEmail(emailParam);
    if (otpParam) {
      setOtp(otpParam);
      setMode('OTP');
    }
    if (tokenParam) {
      setToken(tokenParam);
      setMode('TOKEN');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await fetchApi('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: mode === 'OTP' ? email : undefined,
          otp: mode === 'OTP' ? otp : undefined,
          token: mode === 'TOKEN' ? token : undefined,
          newPassword,
        }),
      });

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12">
      <div className="bg-card text-card-foreground border border-border rounded-xl p-6 md:p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-primary text-primary-foreground rounded-md flex items-center justify-center mx-auto mb-4 shadow-md">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="font-heading text-2xl font-bold">Reset Password</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Enter your verification details and choose a new password
          </p>
        </div>

        {error && (
          <div className="bg-destructive/15 border border-destructive text-destructive rounded-md p-3 text-sm mb-5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {success ? (
          <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-md p-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h3 className="font-heading text-lg font-bold text-emerald-400">
              Password Updated Successfully!
            </h3>
            <p className="text-xs text-muted-foreground mt-1 mb-6">
              Your password has been changed. All active user sessions have been revoked for your security.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-md border border-primary cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              Sign In with New Password <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div>
            {/* Tab Selector */}
            <div className="flex bg-muted/60 p-1 rounded-md border border-border mb-5">
              <button
                type="button"
                onClick={() => setMode('OTP')}
                className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-sm cursor-pointer transition-colors ${
                  mode === 'OTP'
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground bg-transparent'
                }`}
              >
                🔢 6-Digit OTP Code
              </button>
              <button
                type="button"
                onClick={() => setMode('TOKEN')}
                className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-sm cursor-pointer transition-colors ${
                  mode === 'TOKEN'
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground bg-transparent'
                }`}
              >
                🔗 Magic Link Token
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode === 'OTP' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. user@example.com"
                      className="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      6-Digit OTP Code
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="e.g. 849201"
                      className="w-full px-3.5 py-3 bg-input border border-border rounded-md text-foreground text-xl tracking-[4px] text-center font-mono focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Magic Link Reset Token
                  </label>
                  <input
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Enter reset token from link"
                    className="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-foreground font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>
              )}

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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-md border border-primary cursor-pointer transition-colors shadow-sm mt-2 disabled:opacity-50"
              >
                {loading ? 'Updating Password...' : 'Reset Password'}
              </button>
            </form>
          </div>
        )}

        <p className="text-center mt-6 text-sm text-muted-foreground">
          Remember your password?{' '}
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading reset form...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
