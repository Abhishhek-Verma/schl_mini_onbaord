'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchApi } from '@/lib/api';
import { Monitor, Smartphone, Tablet, Globe, Trash2, LogOut, RefreshCw, Loader2 } from 'lucide-react';

interface Session {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  ipAddress: string;
  deviceName: string;
  browser: string;
  os: string;
  isCurrent: boolean;
}

function getDeviceIcon(os: string) {
  const lower = os.toLowerCase();
  if (lower.includes('iphone') || lower.includes('android')) return <Smartphone className="w-4 h-4 text-cyan-500" />;
  if (lower.includes('ipad')) return <Tablet className="w-4 h-4 text-cyan-500" />;
  if (lower.includes('mac') || lower.includes('windows') || lower.includes('linux') || lower.includes('chrome os'))
    return <Monitor className="w-4 h-4 text-primary" />;
  return <Globe className="w-4 h-4 text-muted-foreground" />;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function ActiveSessions() {
  const { accessToken } = useAuthStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<{ sessions: Session[]; total: number }>(
        '/sessions',
        {},
        accessToken
      );
      setSessions(data.sessions);
      if (!data.sessions || data.sessions.length === 0) {
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login?expired=1';
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRevoke = async (sessionId: string) => {
    if (!accessToken) return;
    setRevoking(sessionId);
    setSuccessMsg(null);
    setError(null);
    try {
      await fetchApi(`/sessions/${sessionId}`, { method: 'DELETE' }, accessToken);
      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== sessionId);
        if (remaining.length === 0) {
          useAuthStore.getState().logout();
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login?expired=1';
          }
        }
        return remaining;
      });
      setSuccessMsg('Session revoked successfully');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    if (!accessToken) return;
    setRevokingAll(true);
    setSuccessMsg(null);
    setError(null);
    try {
      const result = await fetchApi<{ message: string; revokedCount: number }>(
        '/sessions',
        { method: 'DELETE' },
        accessToken
      );
      setSessions((prev) => prev.filter((s) => s.isCurrent));
      setSuccessMsg(result.message);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to revoke sessions');
    } finally {
      setRevokingAll(false);
    }
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="bg-card text-card-foreground border border-border rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-lg font-bold flex items-center gap-2">
          <Monitor className="w-5 h-5 text-primary" /> Active Sessions
        </h3>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-medium">
            {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={loadSessions}
            disabled={loading}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground bg-transparent border-0 cursor-pointer"
            title="Refresh sessions"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-md p-3 text-sm mb-4">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="bg-destructive/15 border border-destructive text-destructive rounded-md p-3 text-sm mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          <p className="mt-2 text-xs">Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-muted-foreground text-center py-6 text-sm">
          No active sessions found.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center justify-between gap-4 p-4 rounded-lg border transition-colors ${
                  session.isCurrent
                    ? 'bg-primary/10 border-primary/40'
                    : 'bg-muted/50 border-border hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center shrink-0">
                    {getDeviceIcon(session.os)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      {session.deviceName}
                      {session.isCurrent && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                          This device
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {session.ipAddress} • Last active {timeAgo(session.lastUsedAt)} • Signed in{' '}
                      {timeAgo(session.createdAt)}
                    </div>
                  </div>
                </div>

                {!session.isCurrent && (
                  <button
                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5"
                    onClick={() => handleRevoke(session.id)}
                    disabled={revoking === session.id}
                  >
                    {revoking === session.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" /> Revoke
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>

          {otherSessionsCount > 0 && (
            <div className="mt-5 text-right">
              <button
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 cursor-pointer transition-colors"
                onClick={handleRevokeAll}
                disabled={revokingAll}
              >
                {revokingAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                {revokingAll
                  ? 'Revoking...'
                  : `Sign out all other sessions (${otherSessionsCount})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
