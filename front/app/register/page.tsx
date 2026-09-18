'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchApi } from '@/lib/api';
import { UserPlus, AlertCircle, Mail, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';
import { routeForRole } from '@/lib/auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [screen, setScreen] = useState<'REGISTER_FORM' | 'EMAIL_SENT' | 'ENTER_OTP'>('REGISTER_FORM');

  // Form Fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'USER' | 'ADMIN' | 'TEACHER' | 'PRINCIPAL'>('USER');

  // OTP Verification state
  const [otp, setOtp] = useState('');
  const [registeredUserSession, setRegisteredUserSession] = useState<{
    user: any;
    accessToken: string;
    refreshToken: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Step 1: Create Account & Dispatch Verification Email
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetchApi('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username,
          email,
          phoneNumber: phoneNumber || undefined,
          password,
          displayName: displayName || username,
          role,
        }),
      });

      // Save initial session & advance to Screen 2
      setRegisteredUserSession(res);
      setScreen('EMAIL_SENT');
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please check inputs.');
    } finally {
      setLoading(false);
    }
  };

  // Resend Verification Email
  const handleResendEmail = async () => {
    setLoading(true);
    setError(null);
    setResendSuccess(false);

    try {
      await fetchApi('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 3500);
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification email');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Enter 6-Digit Verification OTP & Activate Account
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    setVerifyingOtp(true);
    setError(null);

    try {
      await fetchApi('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      });

      setSuccess(true);

      if (registeredUserSession) {
        const registeredUser = registeredUserSession.user;
        setAuth(
          { ...registeredUser, isEmailVerified: true },
          registeredUserSession.accessToken,
          registeredUserSession.refreshToken
        );
        const nextRoute = routeForRole(registeredUser.role);
        setTimeout(() => router.push(nextRoute), 1200);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid or expired 6-digit verification code.');
    } finally {
      setVerifyingOtp(false);
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
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Fresh verification code sent to your inbox!
          </div>
        )}

        {/* SCREEN 1: Registration Form */}
        {screen === 'REGISTER_FORM' && (
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-md flex items-center justify-center mx-auto mb-4 shadow-md">
                <UserPlus className="w-6 h-6" />
              </div>
              <h2 className="font-heading text-2xl font-bold">Create Account</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Join with email verification & secure authentication
              </p>
            </div>

            <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="johndoe"
                    className="w-full px-3.5 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-3.5 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-3.5 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Phone Number <span className="font-normal text-muted-foreground/70">(Optional)</span>
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. +919876543210"
                  className="w-full px-3.5 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Role Assignment
                </label>
                <Select
                  value={role}
                  onValueChange={(val) => {
                    if (val) setRole(val as 'USER' | 'ADMIN' | 'TEACHER' | 'PRINCIPAL');
                  }}
                >
                  <SelectTrigger className="w-full h-10 px-3.5 bg-input border border-border rounded-md text-foreground text-sm">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">USER (Standard Member)</SelectItem>
                    <SelectItem value="ADMIN">ADMIN (Full Control)</SelectItem>
                    <SelectItem value="TEACHER">TEACHER</SelectItem>
                    <SelectItem value="PRINCIPAL">PRINCIPAL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-md border border-primary cursor-pointer transition-colors shadow-sm mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : 'Continue'} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* SCREEN 2: Email Dispatched Prompt */}
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
                onClick={() => { setScreen('REGISTER_FORM'); setError(null); setOtp(''); }}
                className="bg-transparent border-0 text-muted-foreground/60 hover:text-muted-foreground text-xs cursor-pointer"
              >
                Use a different email
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 3: Enter Verification Code */}
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

            {success ? (
              <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-md p-5 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <h3 className="font-heading text-lg font-bold text-emerald-400">
                  Email Verified & Account Activated!
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Welcome! Redirecting you to your dashboard...
                </p>
              </div>
            ) : (
              <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Enter 6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="e.g. 813435"
                    className="w-full px-3.5 py-3 bg-input border border-border rounded-md text-foreground text-xl tracking-[4px] text-center font-mono focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={verifyingOtp}
                  className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-md border border-primary cursor-pointer transition-colors shadow-sm mt-2 disabled:opacity-50"
                >
                  {verifyingOtp ? 'Verifying Code...' : 'Verify & Complete Registration'}
                </button>
              </form>
            )}
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
