'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchApi } from '@/lib/api';
import { CheckCircle2, AlertCircle, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

function MagicLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setError('Invalid magic link URL token');
      setLoading(false);
      return;
    }

    const performMagicLogin = async () => {
      try {
        const res = await fetchApi('/auth/magic-login', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });

        setAuth(res.user, res.accessToken, res.refreshToken);
        setSuccess(true);

        setTimeout(() => {
          router.push('/');
        }, 1200);
      } catch (err: any) {
        setError(err.message || 'Magic Link has expired or already been used.');
      } finally {
        setLoading(false);
      }
    };

    performMagicLogin();
  }, [searchParams, setAuth, router]);

  return (
    <div className="max-w-md mx-auto my-16">
      <div className="bg-card text-card-foreground border border-border rounded-xl p-8 shadow-xl text-center">
        {loading && (
          <div>
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
            <h2 className="font-heading text-xl font-bold">Authenticating Magic Link...</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Verifying your instant sign-in token
            </p>
          </div>
        )}

        {error && (
          <div>
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="font-heading text-xl font-bold text-destructive">
              Magic Link Invalid
            </h2>
            <p className="text-muted-foreground text-sm mt-1 mb-6">
              {error}
            </p>
            <Link href="/forgot-password">
              <button className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-md border border-primary cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-2">
                Request New Recovery Email <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        )}

        {success && (
          <div>
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="font-heading text-xl font-bold text-emerald-400">
              Signed In Successfully!
            </h2>
            <p className="text-muted-foreground text-sm mt-1 mb-5">
              Welcome back! Redirecting you to your dashboard...
            </p>
            <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" /> Magic Link Authenticated
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MagicLoginPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-muted-foreground">Processing magic link...</div>}>
      <MagicLoginContent />
    </Suspense>
  );
}
