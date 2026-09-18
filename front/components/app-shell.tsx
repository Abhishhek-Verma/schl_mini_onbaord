'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Navbar, ThemeToggleButton } from '@/components/Navbar';
import { useAuthStore } from '@/store/useAuthStore';
import { LogOut } from 'lucide-react';

const AUTH_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/magic-login',
  '/select-role',
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isHydrated, isAuthenticated, logout } = useAuthStore();

  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith(`${route}/`)
  );

  if (isAuthRoute) {
    return <main className="min-h-screen flex flex-col">{children}</main>;
  }

  // Onboarding check: Keep sidebar hidden throughout onboarding
  const isTeacherOnboarding =
    isHydrated &&
    isAuthenticated &&
    user?.role === 'TEACHER' &&
    !user?.onboardingCompleted;

  const isPrincipalOnboarding =
    isHydrated &&
    isAuthenticated &&
    user?.role === 'PRINCIPAL' &&
    !user?.onboardingCompleted;

  if (isTeacherOnboarding || isPrincipalOnboarding) {
    const roleLabel = isTeacherOnboarding ? 'Teacher Onboarding' : 'Principal Onboarding';
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6 sticky top-0 bg-background/95 backdrop-blur z-30">
          <div className="flex items-center gap-3">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-sm">
              S
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-base">Schoolmini</span>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {roleLabel}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggleButton />
            {user && (
              <div className="flex items-center gap-2 pl-3 border-l border-border">
                <span className="text-sm font-medium hidden sm:inline-block text-muted-foreground">
                  {user.displayName || user.username}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.push('/login');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
                >
                  <LogOut className="size-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Navbar />
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
