import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function getInitials(name) {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  return parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

/**
 * Navbar
 * `onMenuClick` toggles the sidebar open on mobile (hamburger icon).
 * `title` lets each page set its own header text in the top bar.
 */
export default function Navbar({ title, onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button className="navbar-menu-btn" onClick={onMenuClick} aria-label="Open menu">
          <i className="bi bi-list" />
        </button>
        <span className="navbar-title">{title}</span>
      </div>

      <div className="navbar-right">
        <button className="navbar-icon-btn" title="Notifications">
          <i className="bi bi-bell-fill" />
          <span className="navbar-badge">2</span>
        </button>

        <div className="navbar-user">
          <div className="navbar-avatar">{getInitials(user?.full_name || user?.username)}</div>
          <div>
            <div className="navbar-username">{user?.full_name || user?.username}</div>
            <div className="navbar-account">{user?.account_number}</div>
          </div>
        </div>

        <button className="btn btn-secondary btn-icon" onClick={handleLogout} title="Logout">
          <i className="bi bi-box-arrow-right" />
        </button>
      </div>
    </header>
  );
}