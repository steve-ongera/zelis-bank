import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000/api/";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// --- Attach access token to every request ---
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("zelis_access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Auto-refresh on 401, retry original request once ---
let isRefreshing = false;
let pendingQueue = [];

function resolvePending(token) {
  pendingQueue.forEach(({ resolve }) => resolve(token));
  pendingQueue = [];
}

function rejectPending(error) {
  pendingQueue.forEach(({ reject }) => reject(error));
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint =
      originalRequest?.url?.includes("auth/login") ||
      originalRequest?.url?.includes("auth/refresh");

    if (error.response?.status !== 401 || isAuthEndpoint || originalRequest._retry) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem("zelis_refresh");
    if (!refreshToken) {
      localStorage.removeItem("zelis_access");
      window.location.href = "/login";
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((newToken) => {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(`${BASE_URL}auth/refresh/`, {
        refresh: refreshToken,
      });
      localStorage.setItem("zelis_access", data.access);
      if (data.refresh) {
        localStorage.setItem("zelis_refresh", data.refresh);
      }
      resolvePending(data.access);
      originalRequest.headers.Authorization = `Bearer ${data.access}`;
      return api(originalRequest);
    } catch (refreshError) {
      rejectPending(refreshError);
      localStorage.removeItem("zelis_access");
      localStorage.removeItem("zelis_refresh");
      localStorage.removeItem("zelis_user");
      window.location.href = "/login";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;