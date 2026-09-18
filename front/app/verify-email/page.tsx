'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { Mail, CheckCircle2, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, setAuth } = useAuthStore();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    const otpParam = searchParams.get('otp');
    const emailParam = searchParams.get('email');

    if (emailParam) setEmail(emailParam);
    else if (user?.email) setEmail(user.email);

    if (tokenParam) {
      setToken(tokenParam);
      autoVerify({ token: tokenParam });
    } else if (otpParam && emailParam) {
      setOtp(otpParam);
      autoVerify({ email: emailParam, otp: otpParam });
    }
  }, [searchParams, user]);

  const autoVerify = async (payload: { email?: string; otp?: string; token?: string }) => {
    setLoading(true);
    setError(null);
    try {
      await fetchApi('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setVerified(true);
      if (user) {
        setAuth({ ...user, isEmailVerified: true }, useAuthStore.getState().accessToken || '');
      }
    } catch (err: any) {
      setError(err.message || 'Email verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    autoVerify({ email, otp });
  };

  const handleResendOTP = async () => {
    if (!email) return;
    setResending(true);
    setResendMsg(null);
    setError(null);

    try {
      const res = await fetchApi('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setResendMsg(res.message || 'Verification code dispatched to your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12">
      <div className="bg-card text-card-foreground border border-border rounded-xl p-6 md:p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 rounded-md flex items-center justify-center mx-auto mb-4 shadow-md">
            <Mail className="w-6 h-6" />
          </div>
          <h2 className="font-heading text-2xl font-bold">Verify Your Email</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Verify your email address to unlock full platform features
          </p>
        </div>

        {error && (
          <div className="bg-destructive/15 border border-destructive text-destructive rounded-md p-3 text-sm mb-5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {resendMsg && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-md p-3 text-sm mb-5 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {resendMsg}
          </div>
        )}

        {verified ? (
          <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-md p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="font-heading text-lg font-bold text-emerald-400">
              Email Verified!
            </h3>
            <p className="text-xs text-muted-foreground mt-1 mb-6">
              Your email address has been verified. You now have full access to your account.
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-md border border-primary cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Account Email Address
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
                6-Digit Verification Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="e.g. 740192"
                className="w-full px-3.5 py-3 bg-input border border-border rounded-md text-foreground text-xl tracking-[4px] text-center font-mono focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-md border border-primary cursor-pointer transition-colors shadow-sm mt-2 disabled:opacity-50"
            >
              {loading ? 'Verifying Code...' : 'Verify Email'}
            </button>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={resending || !email}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border cursor-pointer transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                {resending ? 'Sending Email...' : 'Resend Verification Code'}
              </button>
            </div>
          </form>
        )}

        <p className="text-center mt-6 text-sm text-muted-foreground">
          Need help?{' '}
          <Link href="/" className="text-primary font-semibold hover:underline">
            Return to Home
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading verification...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
