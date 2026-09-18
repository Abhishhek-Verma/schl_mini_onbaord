"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Edit,
  History,
  Shield,
  Server,
  User as UserIcon,
  Mail,
  Phone,
  Globe,
  Sliders,
  Clock,
  Lock,
  ArrowRight,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { fetchApi, API_BASE_URL } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PlatformConsolePage() {
  const { user, isAuthenticated, isHydrated, setAuth } = useAuthStore();

  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<any | null>(null);
  const [showAuditDrawer, setShowAuditDrawer] = useState<any | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: "",
    slug: "",
    planCode: "smart",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    region: "in",
  });

  const [editForm, setEditForm] = useState({
    name: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    planCode: "smart",
    region: "in",
  });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Obtain JWT token based on current user role
  const obtainRoleToken = useCallback(async (role: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/platform/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (data.token) {
        setAuthToken(data.token);
      }
    } catch (err) {
      console.error("Failed to obtain platform token:", err);
    }
  }, []);

  // Update token when user changes or role switches
  useEffect(() => {
    if (user && user.role) {
      obtainRoleToken(user.role);
    } else {
      obtainRoleToken("SUPER_ADMIN");
    }
  }, [user, obtainRoleToken]);

  // Fetch tenants from backend
  const loadTenants = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      let endpoint = "/platform/tenants";
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (params.toString()) endpoint += `?${params.toString()}`;

      const res = await fetchApi(endpoint, {}, authToken);
      setTenants(res.data || []);
    } catch (err: any) {
      showToast(`Error fetching tenants: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [authToken, searchQuery, statusFilter]);

  useEffect(() => {
    if (authToken && user && (user.role === "SUPER_ADMIN" || user.role === "ADMIN" || user.role === "AGENT" || user.role === "BILLING_ADMIN")) {
      loadTenants();
    }
  }, [authToken, user, loadTenants]);

  // Role Elevation Helper (Demo Switcher)
  const handleElevateRole = (newRole: string) => {
    const updatedUser = {
      id: user?.id || "usr-superadmin",
      username: user?.username || "superadmin",
      email: user?.email || "admin@schoolmini.in",
      displayName: user?.displayName || "Aman Mittal",
      role: newRole as any,
    };
    setAuth(updatedUser, authToken || "");
    showToast(`Role updated to ${newRole}. Re-evaluating RBAC guards.`);
  };

  // Create Tenant Handler
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchApi(
        "/platform/tenants",
        {
          method: "POST",
          body: JSON.stringify(createForm),
        },
        authToken
      );

      showToast(`School "${res.data.name}" provisioned successfully on backend!`);
      setShowCreateModal(false);
      setCreateForm({
        name: "",
        slug: "",
        planCode: "smart",
        ownerName: "",
        ownerEmail: "",
        ownerPhone: "",
        region: "in",
      });
      loadTenants();
    } catch (err: any) {
      showToast(`Creation failed: ${err.message}`);
    }
  };

  // Edit Tenant Handler
  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;
    try {
      await fetchApi(
        `/platform/tenants/${showEditModal.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(editForm),
        },
        authToken
      );

      showToast(`Tenant "${showEditModal.name}" updated successfully!`);
      setShowEditModal(null);
      loadTenants();
    } catch (err: any) {
      showToast(`Update failed: ${err.message}`);
    }
  };

  // Suspend / Reactivate Handler
  const handleToggleSuspend = async (tenant: any) => {
    const isSuspended = tenant.status === "SUSPENDED";
    const endpoint = `/platform/tenants/${tenant.id}/${isSuspended ? "reactivate" : "suspend"}`;
    try {
      await fetchApi(
        endpoint,
        {
          method: "POST",
          body: JSON.stringify({ reason: "Status toggle from Platform Console UI" }),
        },
        authToken
      );

      showToast(`School ${tenant.name} updated to ${isSuspended ? "ACTIVE" : "SUSPENDED"}`);
      loadTenants();
    } catch (err: any) {
      showToast(`Action failed: ${err.message}`);
    }
  };

  // Terminate Handler
  const handleTerminate = async (tenant: any) => {
    if (!confirm(`Are you sure you want to terminate ${tenant.name}? This action offboards the school.`)) return;
    try {
      await fetchApi(
        `/platform/tenants/${tenant.id}/terminate`,
        {
          method: "POST",
          body: JSON.stringify({ reason: "Manual termination by Super Admin" }),
        },
        authToken
      );

      showToast(`School ${tenant.name} updated to TERMINATED.`);
      loadTenants();
    } catch (err: any) {
      showToast(`Termination failed: ${err.message}`);
    }
  };

  // View Audit Log Drawer
  const handleViewAudit = async (tenant: any) => {
    try {
      const res = await fetchApi(`/platform/tenants/${tenant.id}`, {}, authToken);
      setShowAuditDrawer(res.data);
    } catch (err: any) {
      showToast(`Failed to load audit trail: ${err.message}`);
    }
  };

  // KPI Calculations
  const totalTenants = tenants.length;
  const activeCount = tenants.filter((t) => t.status === "ACTIVE").length;
  const suspendedCount = tenants.filter((t) => t.status === "SUSPENDED").length;
  const provisioningCount = tenants.filter((t) => t.status === "PROVISIONING").length;

  // Allowed Platform Roles
  const isPlatformRole = user && ["SUPER_ADMIN", "ADMIN", "AGENT", "BILLING_ADMIN", "SALES_ONBOARDING"].includes(user.role || "");

  // 1. Loading Hydration State
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-muted-foreground text-sm font-medium">
          <RefreshCw className="w-5 h-5 animate-spin text-primary" />
          <span>Verifying authentication context...</span>
        </div>
      </div>
    );
  }

  // 2. Role-Based Protection Guard (Unauthenticated or Non-Platform Role like 'USER')
  if (!isAuthenticated || !user || !isPlatformRole) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-lg w-full text-center space-y-6 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto border border-red-500/20">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="bg-red-500/20 text-red-500 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              HTTP 403 Forbidden · Role Restricted
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight">Access Restricted</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The <strong>Tier-1 Platform Console</strong> is strictly restricted to platform personnel (Super Admins, Support Agents, and Billing Admins).
            </p>
          </div>

          {/* Current Role Warning */}
          <div className="p-4 bg-secondary/50 rounded-xl border border-border text-left text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Logged-in User:</span>
              <strong className="text-foreground">{user?.displayName || "Guest / Unauthenticated"}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Current Role:</span>
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-500 font-bold rounded text-[11px] uppercase">
                {user?.role || "NONE"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              Required Roles: <code>SUPER_ADMIN</code>, <code>ADMIN</code>, <code>AGENT</code>, <code>BILLING_ADMIN</code>
            </p>
          </div>

          {/* Action Options */}
          <div className="space-y-3 pt-2">
            <button
              onClick={() => handleElevateRole("SUPER_ADMIN")}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow transition"
            >
              <UserCheck className="w-4 h-4" /> Elevate Role to SUPER_ADMIN (Demo Mode)
            </button>

            <div className="flex gap-2">
              <Link href="/profile" className="flex-1">
                <button className="w-full bg-secondary hover:bg-secondary/80 text-foreground font-semibold py-2 rounded-xl text-xs border border-border">
                  My Profile
                </button>
              </Link>
              <Link href="/" className="flex-1">
                <button className="w-full bg-secondary hover:bg-secondary/80 text-foreground font-semibold py-2 rounded-xl text-xs border border-border">
                  Return Home
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authorized Platform Console Workspace
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-xl border border-border flex items-center gap-3 animate-in fade-in">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <header className="h-16 border-b border-border bg-card/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-white">
              SM
            </div>
            <div>
              <h1 className="font-bold text-base leading-none">Tier-1 Platform Console</h1>
              <p className="text-xs text-muted-foreground">
                Role: <strong className="text-primary">{user.role}</strong> · Tenant Lifecycle Management
              </p>
            </div>
          </div>

          <div className="h-6 w-[1px] bg-border mx-2" />

          {/* Search Bar */}
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search school name, slug, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-secondary/50 text-xs rounded-lg pl-9 pr-4 py-2 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={(val) => val && setStatusFilter(val)}>
            <SelectTrigger className="bg-secondary/50 text-xs rounded-lg px-3 py-2 border border-border h-9 min-w-[130px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active Only</SelectItem>
              <SelectItem value="PROVISIONING">Provisioning Only</SelectItem>
              <SelectItem value="SUSPENDED">Suspended Only</SelectItem>
              <SelectItem value="TERMINATED">Terminated Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Right Header Buttons */}
        <div className="flex items-center gap-3">
          {/* Quick Role Switcher for Testing RBAC */}
          <div className="flex items-center gap-2 bg-secondary/80 px-3 py-1 rounded-lg border border-border text-xs">
            <span className="text-muted-foreground font-medium">Role:</span>
            <Select value={user.role || "USER"} onValueChange={(val) => val && handleElevateRole(val)}>
              <SelectTrigger className="bg-transparent border-0 font-bold text-foreground h-7 p-0 gap-1 shadow-none hover:bg-transparent focus-visible:ring-0">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SUPER_ADMIN">SUPER_ADMIN</SelectItem>
                <SelectItem value="AGENT">AGENT</SelectItem>
                <SelectItem value="BILLING_ADMIN">BILLING_ADMIN</SelectItem>
                <SelectItem value="USER">USER (Restricted)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <button
            onClick={loadTenants}
            title="Refresh Tenants"
            className="p-2 hover:bg-secondary rounded-lg text-muted-foreground transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow"
          >
            <Plus className="w-4 h-4" /> Provision New School
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card p-5 rounded-xl border border-border space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Total Provisioned Tenants</span>
              <Building2 className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold">{totalTenants}</p>
          </div>

          <div className="bg-card p-5 rounded-xl border border-border space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Active Schools</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-500">{activeCount}</p>
          </div>

          <div className="bg-card p-5 rounded-xl border border-border space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Provisioning Pipeline</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-500">{provisioningCount}</p>
          </div>

          <div className="bg-card p-5 rounded-xl border border-border space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Suspended Schools</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-500">{suspendedCount}</p>
          </div>
        </div>

        {/* Data Table Container */}
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-bold text-sm">Tenant School Registry (PostgreSQL)</h3>
            <span className="text-xs text-muted-foreground">Showing {tenants.length} record(s)</span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/60 text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="p-3.5">School Name</th>
                <th className="p-3.5">Subdomain Slug</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Plan</th>
                <th className="p-3.5">Owner Contact</th>
                <th className="p-3.5">Region</th>
                <th className="p-3.5">Created Date</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-secondary/30 transition">
                  <td className="p-3.5 font-bold text-foreground">{t.name}</td>
                  <td className="p-3.5 font-mono text-muted-foreground">{t.slug}</td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.status === "ACTIVE"
                          ? "bg-emerald-500/20 text-emerald-500"
                          : t.status === "SUSPENDED"
                          ? "bg-amber-500/20 text-amber-500"
                          : t.status === "TERMINATED"
                          ? "bg-red-500/20 text-red-500"
                          : "bg-blue-500/20 text-blue-500"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 bg-secondary text-foreground rounded font-mono text-[11px] uppercase">
                      {t.planCode}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <p className="font-semibold">{t.ownerName}</p>
                    <p className="text-muted-foreground text-[11px]">{t.ownerEmail}</p>
                  </td>
                  <td className="p-3.5 uppercase font-mono">{t.region}</td>
                  <td className="p-3.5 text-muted-foreground font-mono text-[11px]">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3.5 text-right space-x-1.5">
                    <button
                      onClick={() => {
                        setShowEditModal(t);
                        setEditForm({
                          name: t.name,
                          ownerName: t.ownerName,
                          ownerEmail: t.ownerEmail,
                          ownerPhone: t.ownerPhone || "",
                          planCode: t.planCode || "smart",
                          region: t.region || "in",
                        });
                      }}
                      title="Edit Tenant Profile"
                      className="px-2 py-1 bg-secondary hover:bg-secondary/80 rounded text-[11px] font-medium border border-border inline-flex items-center gap-1"
                    >
                      <Edit className="w-3 h-3" /> Edit
                    </button>

                    <button
                      onClick={() => handleViewAudit(t)}
                      title="View Audit Trail"
                      className="px-2 py-1 bg-secondary hover:bg-secondary/80 rounded text-[11px] font-medium border border-border inline-flex items-center gap-1"
                    >
                      <History className="w-3 h-3" /> Audit
                    </button>

                    <button
                      onClick={() => handleToggleSuspend(t)}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                        t.status === "SUSPENDED"
                          ? "bg-emerald-500 text-white hover:bg-emerald-600"
                          : "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30"
                      }`}
                    >
                      {t.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                    </button>

                    {t.status !== "TERMINATED" && (
                      <button
                        onClick={() => handleTerminate(t)}
                        className="px-2 py-1 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded text-[11px] font-semibold"
                      >
                        Terminate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground text-xs">
                    No school tenants found in database. Click &quot;Provision New School&quot; to create your first tenant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* CREATE TENANT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base">Provision New School Tenant</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">School Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Delhi Public School RK Puram"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full bg-secondary/50 text-xs rounded-lg px-3 py-2 border border-border mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Subdomain Slug</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. dpsrkp"
                  value={createForm.slug}
                  onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value.toLowerCase() })}
                  className="w-full bg-secondary/50 text-xs rounded-lg px-3 py-2 border border-border mt-1 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Subscription Plan Tier</label>
                <Select
                  value={createForm.planCode}
                  onValueChange={(val) => val && setCreateForm({ ...createForm, planCode: val })}
                >
                  <SelectTrigger className="w-full bg-secondary/50 text-xs rounded-lg px-3 py-2 border border-border h-9">
                    <SelectValue placeholder="Select Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mini">Mini Plan</SelectItem>
                    <SelectItem value="smart">Smart Plan</SelectItem>
                    <SelectItem value="pro">Pro Plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2 border-t border-border space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground">School Owner Account Details</p>
                <input
                  required
                  type="text"
                  placeholder="Owner Full Name"
                  value={createForm.ownerName}
                  onChange={(e) => setCreateForm({ ...createForm, ownerName: e.target.value })}
                  className="w-full bg-secondary/50 text-xs rounded-lg px-3 py-2 border border-border"
                />
                <input
                  required
                  type="email"
                  placeholder="Owner Email Address"
                  value={createForm.ownerEmail}
                  onChange={(e) => setCreateForm({ ...createForm, ownerEmail: e.target.value })}
                  className="w-full bg-secondary/50 text-xs rounded-lg px-3 py-2 border border-border"
                />
                <input
                  type="text"
                  placeholder="Owner Phone Number"
                  value={createForm.ownerPhone}
                  onChange={(e) => setCreateForm({ ...createForm, ownerPhone: e.target.value })}
                  className="w-full bg-secondary/50 text-xs rounded-lg px-3 py-2 border border-border"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-3 py-1.5 text-xs text-muted-foreground">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded-lg">
                  Provision School
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TENANT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base">Edit Tenant Profile ({showEditModal.slug})</h3>
              <button onClick={() => setShowEditModal(null)} className="text-muted-foreground hover:text-foreground text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateTenant} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">School Name</label>
                <input
                  required
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-secondary/50 text-xs rounded-lg px-3 py-2 border border-border mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Owner Name</label>
                <input
                  required
                  type="text"
                  value={editForm.ownerName}
                  onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })}
                  className="w-full bg-secondary/50 text-xs rounded-lg px-3 py-2 border border-border mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Owner Email</label>
                <input
                  required
                  type="email"
                  value={editForm.ownerEmail}
                  onChange={(e) => setEditForm({ ...editForm, ownerEmail: e.target.value })}
                  className="w-full bg-secondary/50 text-xs rounded-lg px-3 py-2 border border-border mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Plan Tier</label>
                <Select
                  value={editForm.planCode}
                  onValueChange={(val) => val && setEditForm({ ...editForm, planCode: val })}
                >
                  <SelectTrigger className="w-full bg-secondary/50 text-xs rounded-lg px-3 py-2 border border-border h-9">
                    <SelectValue placeholder="Select Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mini">Mini Plan</SelectItem>
                    <SelectItem value="smart">Smart Plan</SelectItem>
                    <SelectItem value="pro">Pro Plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowEditModal(null)} className="px-3 py-1.5 text-xs text-muted-foreground">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded-lg">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT TRAIL DRAWER */}
      {showAuditDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-card h-full p-6 space-y-4 border-l border-border shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="font-mono text-xs text-muted-foreground">Tenant Audit Trail</span>
                <h3 className="font-bold text-base">{showAuditDrawer.name}</h3>
              </div>
              <button onClick={() => setShowAuditDrawer(null)} className="text-muted-foreground text-xs">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {showAuditDrawer.PlatformAuditLog?.map((log: any) => (
                <div key={log.id} className="p-3 bg-secondary/30 rounded-lg text-xs border border-border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-primary font-bold">{log.action}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">Actor: {log.actorId} ({log.actorRole})</p>
                  {log.details && (
                    <pre className="text-[10px] bg-background p-2 rounded overflow-x-auto font-mono text-foreground mt-1">
                      {log.details}
                    </pre>
                  )}
                </div>
              ))}
              {(!showAuditDrawer.PlatformAuditLog || showAuditDrawer.PlatformAuditLog.length === 0) && (
                <p className="text-xs text-muted-foreground">No audit trail entries for this tenant.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
