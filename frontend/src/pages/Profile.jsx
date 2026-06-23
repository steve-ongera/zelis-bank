import { useEffect, useState } from "react";
import api from "../api/axios";
import AppLayout from "../components/AppLayout";
import LoadingSpinner from "../components/LoadingSpinner";

function formatKES(value) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

const STATUS_BADGE = {
  active: "badge-success",
  pending: "badge-warning",
  rejected: "badge-danger",
  suspended: "badge-danger",
};

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api
      .get("profile/")
      .then(({ data }) => {
        setProfile(data);
        setForm({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
        });
      })
      .catch(() => setError("Could not load your profile."))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const { data } = await api.patch("profile/", form);
      setProfile(data);
      setSuccess("Profile updated successfully.");
    } catch {
      setError("Could not update your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Profile">
        <LoadingSpinner label="Loading profile..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Profile">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your personal and account details.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Personal Information</div>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input
                  name="first_name"
                  className="form-control"
                  value={form.first_name}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input
                  name="last_name"
                  className="form-control"
                  value={form.last_name}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                name="email"
                className="form-control"
                value={form.email}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-control" value={profile.username} disabled />
              <p className="form-hint">Usernames cannot be changed.</p>
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <LoadingSpinner size="sm" /> Saving...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle-fill" /> Save Changes
                </>
              )}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Account Details</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div className="card-subtitle">Account Number</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem", fontFamily: "var(--font-heading)" }}>
                {profile.account.account_number}
              </div>
            </div>
            <div>
              <div className="card-subtitle">Current Balance</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                {formatKES(profile.account.balance)}
              </div>
            </div>
            <div>
              <div className="card-subtitle">Status</div>
              <span className={`badge ${STATUS_BADGE[profile.account.status] || "badge-neutral"}`}>
                {profile.account.status}
              </span>
            </div>
            <div>
              <div className="card-subtitle">Registered Phone</div>
              <div>{profile.account.phone_number}</div>
            </div>
            <div>
              <div className="card-subtitle">Member Since</div>
              <div>
                {new Date(profile.account.created_at).toLocaleDateString("en-KE", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}