import axios from "axios";
import { API_BASE_URL } from "./axiosInstance";

const friendlyErrorMap: Record<string, string> = {
  "Phone already exists":
    "This phone number is already registered. Please log in instead.",
  "Invalid phone or password": "Incorrect phone number or password.",
  "Your account has been disabled":
    "Your account has been disabled. Please contact an admin.",
};

export const getApiErrorMessage = (
  error: unknown,
  fallback = "Something went wrong"
) => {
  if (axios.isAxiosError(error)) {
    const serverMessage =
      error.response?.data?.error || error.response?.data?.message;

    if (typeof serverMessage === "string" && serverMessage.trim()) {
      return friendlyErrorMap[serverMessage] || serverMessage;
    }

    if (!error.response) {
      const isDeployedFrontendUsingLocalhost =
        typeof window !== "undefined" &&
        window.location.hostname !== "localhost" &&
        API_BASE_URL.includes("localhost");

      return isDeployedFrontendUsingLocalhost
        ? "Cannot reach server. This deployed frontend is still pointing to localhost. Set VITE_API_URL in Vercel to your live backend URL. You can use either the server root URL or the /api URL."
        : "Cannot reach server. Please check your internet connection or backend deployment.";
    }

    if (error.response.status >= 500) {
      return "Server error. Please try again in a moment.";
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};
