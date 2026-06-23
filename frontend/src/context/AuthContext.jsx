import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("zelis_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On first load, if we have a token, fetch the latest profile.
    const token = localStorage.getItem("zelis_access");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("profile/")
      .then(({ data }) => {
        setUser((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {
        // token invalid/expired and refresh failed — axios interceptor already redirects
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const { data } = await api.post("auth/login/", { username, password });
    localStorage.setItem("zelis_access", data.access);
    localStorage.setItem("zelis_refresh", data.refresh);
    const minimalUser = {
      username,
      full_name: data.full_name,
      account_number: data.account_number,
      is_staff: data.is_staff,
    };
    localStorage.setItem("zelis_user", JSON.stringify(minimalUser));
    setUser(minimalUser);
    return minimalUser;
  }, []);

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem("zelis_refresh");
    try {
      if (refresh) await api.post("auth/logout/", { refresh });
    } catch {
      // ignore — we're clearing local state regardless
    } finally {
      localStorage.removeItem("zelis_access");
      localStorage.removeItem("zelis_refresh");
      localStorage.removeItem("zelis_user");
      setUser(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await api.get("profile/");
    setUser((prev) => ({ ...prev, ...data }));
    return data;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}