import axios from "axios";
import { showExternalError } from "../context/ToastContext";

const normalizeApiBaseUrl = (url?: string) => {
  const fallbackUrl = "http://localhost:5000/api";

  if (!url?.trim()) {
    return fallbackUrl;
  }

  const trimmedUrl = url.trim().replace(/\/+$/, "");

  if (trimmedUrl.endsWith("/api")) {
    return trimmedUrl;
  }

  return `${trimmedUrl}/api`;
};

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

if (
  typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  !import.meta.env.VITE_API_URL
) {
  console.warn(
    `VITE_API_URL is not set. Using fallback API base URL: ${API_BASE_URL}`
  );
}

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

axiosInstance.interceptors.request.use((config) => {
  const stored = localStorage.getItem("auth");
  let auth: { token?: string } | null = null;
  if (stored) {
    try {
      auth = JSON.parse(stored);
    } catch {
      // Corrupted/manually-edited storage value — treat as logged out
      // rather than throwing here and breaking every outgoing request.
      auth = null;
    }
  }

  if (auth?.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("auth");
      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/login"
      ) {
        window.location.href = "/login";
      }
    } else if (!error.response) {
      // No response at all (network failure, timeout, CORS rejection) —
      // nothing downstream has a server message to show, so this is the
      // only place that ever will.
      showExternalError(
        "Couldn't reach the server. Check your connection and try again."
      );
    } else if (error.response.status >= 500) {
      // A 4xx almost always carries a specific `{ error: "..." }` message
      // that the calling component already shows; a 5xx's message is
      // deliberately generic ("Internal server error") and components
      // rarely bother re-displaying that verbatim, so show it here once
      // instead of leaving a failed action look like it did nothing.
      showExternalError(
        error.response.data?.error || "Something went wrong on our end. Please try again."
      );
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
