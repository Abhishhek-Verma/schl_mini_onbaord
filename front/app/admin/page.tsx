'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchApi } from '@/lib/api';
import {
  Shield,
  ShieldAlert,
  Users,
  CheckCircle2,
  RefreshCw,
  LayoutGrid,
  Table as TableIcon,
  MoreVertical,
  Copy,
  Check,
  BadgeCheck,
  Calendar,
  Mail,
} from 'lucide-react';

interface SystemUser {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  avatar?: string | null;
  role: 'USER' | 'ADMIN';
  isEmailVerified?: boolean;
  createdAt?: string;
}

export default function AdminPage() {
  const { accessToken } = useAuthStore();

  const [adminData, setAdminData] = useState<any>(null);
  const [usersList, setUsersList] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View Mode: 'grid' or 'table'
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Menu Dropdown and Copy state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchAdminData = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Test RBAC Protected Admin Endpoint
      const dash = await fetchApi('/users/admin/dashboard', {}, accessToken);
      setAdminData(dash);

      // 2. Fetch All System Users
      const users = await fetchApi('/users', {}, accessToken);
      if (Array.isArray(users)) {
        setUsersList(users);
      } else if (users && Array.isArray((users as any).users)) {
        setUsersList((users as any).users);
      } else {
        setUsersList([]);
      }
    } catch (err: any) {
      setError(err.message || 'Access denied: Admin role required');
      setUsersList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [accessToken]);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.card-menu-wrapper')) {
        setOpenMenuId(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setOpenMenuId(null);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="px-4 mx-auto py-6">
      {/* RBAC Status Alert */}
      {error && (
        <div className="bg-destructive/15 border border-destructive rounded-xl p-5 mb-6 text-destructive flex items-center gap-3 shadow-md">
          <ShieldAlert className="w-6 h-6 shrink-0" />
          <div>
            <h4 className="font-bold text-base">
              (403 Forbidden)
            </h4>
            <p className="text-sm mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* User Registry Section with View Toggle Tabs */}
      <div className="bg-card text-card-foreground border border-border rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-heading text-lg font-bold">
              Registered System Users
            </h3>
            <span className="text-xs text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full border border-border font-semibold">
              {Array.isArray(usersList) ? usersList.length : 0}
            </span>
          </div>


          <button
            onClick={fetchAdminData}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
          </button>
          {/* View Toggle Tabs */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-md border border-border">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm cursor-pointer transition-colors ${viewMode === 'grid'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'text-muted-foreground hover:text-foreground bg-transparent'
                }`}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grid View
            </button>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm cursor-pointer transition-colors ${viewMode === 'table'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'text-muted-foreground hover:text-foreground bg-transparent'
                }`}
              onClick={() => setViewMode('table')}
            >
              <TableIcon className="w-3.5 h-3.5" /> Table View
            </button>
          </div>
        </div>

        {!Array.isArray(usersList) || usersList.length === 0 ? (
          <p className="text-muted-foreground text-sm py-6 text-center">
            {loading ? 'Loading system user registry...' : 'No system users retrieved.'}
          </p>
        ) : viewMode === 'grid' ? (
          /* GRID / CARDS VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {(Array.isArray(usersList) ? usersList : []).map((u) => {
              const displayName = u.displayName || u.username;
              const initial = displayName.charAt(0).toUpperCase();

              return (
                <div key={u.id} className="bg-muted/50 border border-border rounded-xl p-5 flex flex-col justify-between gap-4 relative hover:border-primary/50 transition-all shadow-sm">
                  {/* Card Header & Main User Info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt={displayName}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-full object-cover border-2 border-primary shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold uppercase shrink-0">
                          {initial}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-heading font-bold text-foreground truncate" title={displayName}>
                            {displayName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">@{u.username}</span>
                          {/* Verified Status Pill */}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border ${u.isEmailVerified
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              }`}
                            title={u.isEmailVerified ? 'Email Verified' : 'Email Unverified'}
                          >
                            <BadgeCheck className="w-3 h-3" />
                            {u.isEmailVerified ? 'Verified' : 'Unverified'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Three Dots Menu Options Dropdown */}
                    <div className="relative card-menu-wrapper">
                      <button
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-md bg-transparent border-0 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === u.id ? null : u.id);
                        }}
                        title="User Actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === u.id && (
                        <div className="absolute top-full right-0 mt-1 w-44 bg-popover border border-border rounded-md shadow-xl p-1 z-30 flex flex-col gap-0.5">
                          <button
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-popover-foreground hover:bg-muted rounded-sm border-0 bg-transparent cursor-pointer text-left"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(u.id, u.id);
                            }}
                          >
                            {copiedId === u.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            {copiedId === u.id ? 'UUID Copied!' : 'Copy UUID'}
                          </button>
                          <button
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-popover-foreground hover:bg-muted rounded-sm border-0 bg-transparent cursor-pointer text-left"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(u.email, `email-${u.id}`);
                            }}
                          >
                            <Mail className="w-3.5 h-3.5" />
                            Copy Email
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Role & Joined Date */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
                    <span
                      className={`px-2.5 py-0.5 font-bold rounded-full uppercase tracking-wider ${u.role === 'ADMIN'
                        ? 'bg-pink-500/15 text-pink-500 border border-pink-500/30'
                        : 'bg-cyan-500/15 text-cyan-500 border border-cyan-500/30'
                        }`}
                    >
                      {u.role || 'USER'}
                    </span>

                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(u.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(Array.isArray(usersList) ? usersList : []).map((u) => {
                  const displayName = u.displayName || u.username;
                  const initial = displayName.charAt(0).toUpperCase();

                  return (
                    <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              alt={displayName}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover border border-primary shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold uppercase shrink-0">
                              {initial}
                            </div>
                          )}
                          <span className="font-semibold text-foreground">{displayName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">@{u.username}</td>
                      <td className="py-3 px-4 text-muted-foreground">{u.email}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wider ${u.role === 'ADMIN'
                            ? 'bg-pink-500/15 text-pink-500 border border-pink-500/30'
                            : 'bg-cyan-500/15 text-cyan-500 border border-cyan-500/30'
                            }`}
                        >
                          {u.role || 'USER'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${u.isEmailVerified
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}
                        >
                          <BadgeCheck className="w-3 h-3" />
                          {u.isEmailVerified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{formatDate(u.createdAt)}</td>
                      <td className="py-3 px-4">
                        <button
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border cursor-pointer transition-colors"
                          onClick={() => copyToClipboard(u.id, u.id)}
                          title={`Copy UUID: ${u.id}`}
                        >
                          {copiedId === u.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          {copiedId === u.id ? 'Copied' : 'Copy UUID'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
