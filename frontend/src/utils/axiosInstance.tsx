import axios from "axios";

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
  const auth = stored ? JSON.parse(stored) : null;

  if (auth?.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }

  return config;
});

export default axiosInstance;
