import { useState } from "react";
import api from "../api/axios";
import AppLayout from "../components/AppLayout";
import LoadingSpinner from "../components/LoadingSpinner";

export default function Settings() {
  const [form, setForm] = useState({ old_password: "", new_password: "", confirm_new: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState({
    email_alerts: true,
    sms_alerts: true,
    transaction_receipts: true,
  });

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.new_password !== form.confirm_new) {
      setError("New passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("profile/change-password/", {
        old_password: form.old_password,
        new_password: form.new_password,
      });
      setSuccess("Password changed successfully.");
      setForm({ old_password: "", new_password: "", confirm_new: "" });
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.old_password?.[0] || data?.new_password?.[0] || "Could not change password.");
    } finally {
      setSubmitting(false);
    }
  };

  const togglePref = (key) => setNotifPrefs((p) => ({ ...p, [key]: !p[key] }));

  return (
    <AppLayout title="Settings">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your security and notification preferences.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <i className="bi bi-shield-lock-fill" /> Change Password
            </div>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input
                type="password"
                name="old_password"
                className="form-control"
                value={form.old_password}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                name="new_password"
                className="form-control"
                value={form.new_password}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                name="confirm_new"
                className="form-control"
                value={form.confirm_new}
                onChange={handleChange}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <LoadingSpinner size="sm" /> Updating...
                </>
              ) : (
                <>
                  <i className="bi bi-key-fill" /> Update Password
                </>
              )}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <i className="bi bi-bell-fill" /> Notification Preferences
            </div>
          </div>

          {[
            { key: "email_alerts", label: "Email alerts for every transaction" },
            { key: "sms_alerts", label: "SMS alerts for every transaction" },
            { key: "transaction_receipts", label: "Send email receipts" },
          ].map((item) => (
            <div
              key={item.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 0",
                borderBottom: "1px solid var(--gray-100)",
              }}
            >
              <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                {item.label}
              </span>
              <button
                onClick={() => togglePref(item.key)}
                style={{
                  width: 46,
                  height: 26,
                  borderRadius: 999,
                  border: "none",
                  background: notifPrefs[item.key] ? "var(--brown-700)" : "var(--gray-300)",
                  position: "relative",
                  transition: "background 0.15s ease",
                }}
                aria-label={`Toggle ${item.label}`}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: notifPrefs[item.key] ? 23 : 3,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "var(--white)",
                    transition: "left 0.15s ease",
                  }}
                />
              </button>
            </div>
          ))}
          <p className="form-hint" style={{ marginTop: 14 }}>
            Note: notification delivery (email/SMS) is not wired to a live provider in this
            demo — this panel just stores your preference locally.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}