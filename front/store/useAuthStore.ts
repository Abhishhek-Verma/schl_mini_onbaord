import { create } from 'zustand';

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  phoneNumber?: string | null;
  role: 'USER' | 'ADMIN' | 'TEACHER' | 'PRINCIPAL' | 'SUPER_ADMIN' | 'AGENT' | 'BILLING_ADMIN' | 'SALES_ONBOARDING' | 'SCHOOL_ADMIN' | string | null;
  avatar?: string | null;
  isEmailVerified?: boolean;
  onboardingCompleted?: boolean;
  demoClassCompleted?: boolean;
  demoVideoUrl?: string | null;
  skillAssessmentCompleted?: boolean;
  teacherProfile?: any;
  principalProfile?: any;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken?: string) => void;
  setAccessToken: (token: string) => void;
  updateUser: (partial: Partial<User>) => void;
  logout: () => void;
  hydrate: () => void;
}

let logoutTimer: NodeJS.Timeout | null = null;

function parseJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
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
}

function clearAutoLogoutTimer() {
  if (logoutTimer) {
    clearTimeout(logoutTimer);
    logoutTimer = null;
  }
}

function scheduleAutoLogout(token: string) {
  clearAutoLogoutTimer();

  const payload = parseJwtPayload(token);
  if (!payload || !payload.exp) return;

  const expiresAtMs = payload.exp * 1000;
  const timeUntilExpire = expiresAtMs - Date.now();

  if (timeUntilExpire <= 0) {
    // Already expired - trigger logout immediately
    useAuthStore.getState().logout();
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login?expired=1';
    }
  } else {
    // Schedule timer to attempt silent refresh or trigger logout when token expires
    logoutTimer = setTimeout(async () => {
      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ''
          ? process.env.NEXT_PUBLIC_API_URL
          : 'http://localhost:4000/api';

      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        const data = await res.json();

        if (res.ok && data.accessToken) {
          useAuthStore.getState().setAccessToken(data.accessToken);
        } else {
          useAuthStore.getState().logout();
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login?expired=1';
          }
        }
      } catch {
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login?expired=1';
        }
      }
    }, timeUntilExpire);
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isHydrated: false,

  setAuth: (user, accessToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('accessToken', accessToken);
    }
    set({
      user,
      accessToken,
      isAuthenticated: true,
      isHydrated: true,
    });
    scheduleAutoLogout(accessToken);
  },

  setAccessToken: (accessToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
    }
    set({ accessToken });
    scheduleAutoLogout(accessToken);
  },

  updateUser: (partial: Partial<User>) => {
    set((state) => {
      if (!state.user) return state;
      const updated = { ...state.user, ...partial };
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(updated));
      }
      return { user: updated };
    });
  },

  logout: () => {
    clearAutoLogoutTimer();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
    }
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isHydrated: true,
    });
  },

  hydrate: async () => {
    if (typeof window === 'undefined') return;
    try {
      const storedUser = localStorage.getItem('user');
      const accessToken = localStorage.getItem('accessToken');

      if (accessToken) {
        // 1. Immediate local sync for fast rendering
        if (storedUser) {
          try {
            set({
              user: JSON.parse(storedUser),
              accessToken,
              isAuthenticated: true,
              isHydrated: true,
            });
            scheduleAutoLogout(accessToken);
          } catch {
            // Ignore parse error
          }
        }

        // 2. Fetch authoritative user details from GET /auth/me to bypass storage tampering
        const API_BASE_URL =
          process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ''
            ? process.env.NEXT_PUBLIC_API_URL
            : 'http://localhost:4000/api';

        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (res.ok) {
          const freshUser = await res.json();
          if (freshUser && (freshUser.id || freshUser.email)) {
            localStorage.setItem('user', JSON.stringify(freshUser));
            set({
              user: freshUser,
              accessToken,
              isAuthenticated: true,
              isHydrated: true,
            });
          }
        } else if (res.status === 401 || res.status === 403 || res.status === 404) {
          useAuthStore.getState().logout();
        } else {
          set({ isHydrated: true });
        }
      } else {
        set({ isHydrated: true });
      }
    } catch {
      set({ isHydrated: true });
    }
  },
}));
