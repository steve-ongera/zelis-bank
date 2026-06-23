import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "./LoadingSpinner";

/**
 * ProtectedRoute
 * Redirects to /login if there's no valid session. While the initial
 * profile check is in flight, shows a full-page spinner instead of
 * flashing the login page then immediately swapping to the dashboard.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullPage label="Checking your session..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}