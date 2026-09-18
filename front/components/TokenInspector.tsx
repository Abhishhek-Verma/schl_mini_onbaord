'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchApi } from '@/lib/api';
import { Key, RefreshCw, Copy, Check, ShieldAlert } from 'lucide-react';

export function TokenInspector() {
  const { accessToken, setAccessToken } = useAuthStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const parseJwt = (token: string | null) => {
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  };

  const decoded = parseJwt(accessToken);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setErrorMsg(null);
    try {
      const res = await fetchApi<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
      });
      setAccessToken(res.accessToken);
    } catch (err: any) {
      setErrorMsg(err.message || 'Token refresh failed');
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login?expired=1';
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const copyToken = () => {
    if (accessToken) {
      navigator.clipboard.writeText(accessToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-card text-card-foreground border border-border rounded-xl p-6 mt-8 shadow-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2.5">
          <Key className="w-5 h-5 text-primary" />
          <h3 className="font-heading text-lg font-bold">JWT Token & Session Inspector</h3>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border cursor-pointer transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Session Token (via httpOnly Cookie)
        </button>
      </div>

      {errorMsg && (
        <div className="bg-destructive/15 border border-destructive text-destructive rounded-md p-3 text-sm mb-4 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" /> {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Raw Access Token */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground font-semibold tracking-wide uppercase">ACCESS TOKEN (JWT)</span>
            <button
              onClick={copyToken}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-0"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="bg-muted text-foreground border border-border rounded-md p-3 font-mono text-xs break-all max-h-28 overflow-y-auto">
            {accessToken || 'No Active Access Token'}
          </div>
        </div>

        {/* Decoded Claims */}
        <div>
          <span className="text-xs text-muted-foreground font-semibold tracking-wide uppercase block mb-1.5">DECODED JWT CLAIMS</span>
          <pre className="bg-muted text-emerald-400 border border-border rounded-md p-3 font-mono text-xs max-h-28 overflow-y-auto">
            {decoded ? JSON.stringify(decoded, null, 2) : '// Log in to inspect payload claims'}
          </pre>
        </div>
      </div>
    </div>
  );
}
