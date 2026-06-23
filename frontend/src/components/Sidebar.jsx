import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/dashboard", icon: "bi-grid-1x2-fill", label: "Dashboard" },
  { to: "/send-money", icon: "bi-send-fill", label: "Send Money" },
  { to: "/deposit", icon: "bi-piggy-bank-fill", label: "Deposit" },
  { to: "/transactions", icon: "bi-receipt", label: "Transactions" },
  { to: "/profile", icon: "bi-person-fill", label: "Profile" },
  { to: "/settings", icon: "bi-gear-fill", label: "Settings" },
];

/**
 * Sidebar
 * On mobile this is hidden off-canvas (transform: translateX(-100%)) and
 * slides in when `isOpen` is true. `onClose` is called when a link is
 * tapped or the overlay is clicked, so navigating on mobile auto-closes it.
 */
export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <i className="bi bi-bank2" />
          </div>
          <span className="sidebar-brand-text">Zelis Bank</span>
        </div>

        <nav className="sidebar-nav">
          <p className="sidebar-section-label">Menu</p>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            >
              <i className={`bi ${item.icon}`} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className={`sidebar-overlay ${isOpen ? "show" : ""}`} onClick={onClose} />
    </>
  );
}