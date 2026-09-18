'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { CustomGoogleButton } from '@/components/CustomGoogleButton';
import { fetchApi } from '@/lib/api';
import { LogIn, AlertCircle, Shield, Clock } from 'lucide-react';
import { routeForRole } from '@/lib/auth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (searchParams.get('expired') === '1') {
      setIsExpired(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });

      setAuth(res.user, res.accessToken, res.refreshToken);
      router.push(routeForRole(res.user.role));
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAdminLogin = () => {
    setIdentifier('admin@example.com');
    setPassword('Password123!');
  };

  return (
    <div className="max-w-md mx-auto my-12">
      <div className="bg-card text-card-foreground border border-border rounded-xl p-6 md:p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-primary text-primary-foreground rounded-md flex items-center justify-center mx-auto mb-4 shadow-md">
            <LogIn className="w-6 h-6" />
          </div>
          <h2 className="font-heading text-2xl font-bold">Welcome Back</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Log in to access your secure profile & dashboard
          </p>
        </div>

        {isExpired && (
          <div className="bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-md p-3 text-sm mb-5 flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0" /> Your session has expired or was revoked. Please log in again.
          </div>
        )}

        {error && (
          <div className="bg-destructive/15 border border-destructive text-destructive rounded-md p-3 text-sm mb-5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Custom Google Sign In Button */}
        <div className="mb-5">
          <CustomGoogleButton onError={(msg) => setError(msg)} />
        </div>

        <div className="relative flex items-center my-6">
          <div className="grow border-t border-border"></div>
          <span className="shrink mx-4 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            or sign in with email
          </span>
          <div className="grow border-t border-border"></div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Username or Email
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. admin@example.com"
              className="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot Password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-md border border-primary cursor-pointer transition-colors shadow-sm mt-2 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-border text-center">
          <button
            onClick={handleDemoAdminLogin}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border cursor-pointer transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-pink-500" /> Auto-fill Demo Admin Credentials
          </button>
        </div>

        <p className="text-center mt-6 text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link href="/register" className="text-primary font-semibold hover:underline">
            Create Account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
