import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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
