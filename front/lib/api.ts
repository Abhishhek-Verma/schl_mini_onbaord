import { useAuthStore } from "@/store/useAuthStore";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ""
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://localhost:4000/api";

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const currentToken = token || useAuthStore.getState().accessToken;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (currentToken) {
    headers["Authorization"] = `Bearer ${currentToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: "include", // Send & receive httpOnly cookies automatically
    ...options,
    headers,
  });

  const data = await response.json();

  // If 401 or 403 authorization error occurs and it's not an auth attempt endpoint
  const isAuthAttempt =
    endpoint.includes("/auth/login") ||
    endpoint.includes("/auth/register") ||
    endpoint.includes("/auth/refresh");

  if ((response.status === 401 || response.status === 403) && !isAuthAttempt) {
    if (isRefreshing) {
      return new Promise<T>((resolve, reject) => {
        failedQueue.push({
          resolve: (newToken: string) => {
            headers["Authorization"] = `Bearer ${newToken}`;
            fetch(`${API_BASE_URL}${endpoint}`, {
              credentials: "include",
              ...options,
              headers,
            })
              .then((res) => res.json())
              .then(resolve)
              .catch(reject);
          },
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      // Attempt silent refresh via refresh token cookie
      const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      const refreshData = await refreshRes.json();

      if (refreshRes.ok && refreshData.accessToken) {
        useAuthStore.getState().setAccessToken(refreshData.accessToken);
        processQueue(null, refreshData.accessToken);

        // Retry original request with new access token
        headers["Authorization"] = `Bearer ${refreshData.accessToken}`;
        const retryRes = await fetch(`${API_BASE_URL}${endpoint}`, {
          credentials: "include",
          ...options,
          headers,
        });
        return await retryRes.json();
      } else {
        throw new Error(refreshData.error || "Session expired");
      }
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      // Auto-logout user and redirect to login page
      useAuthStore.getState().logout();
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        window.location.href = "/login?expired=1";
      }
      throw new Error("Session expired. Please log in again.");
    } finally {
      isRefreshing = false;
    }
  }

  if (!response.ok) {
    // If refresh token is expired or revoked, immediately log out and redirect
    if (endpoint.includes("/auth/refresh") || response.status === 401) {
      useAuthStore.getState().logout();
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        window.location.href = "/login?expired=1";
      }
    }
    throw new Error(data.error || "An error occurred while processing the request.");
  }

  return data;
}

