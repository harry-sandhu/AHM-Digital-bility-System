import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
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
