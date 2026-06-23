import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import LoadingSpinner from "../components/LoadingSpinner";

const initialForm = {
  first_name: "",
  last_name: "",
  username: "",
  email: "",
  phone_number: "",
  id_number: "",
  password: "",
  confirm_password: "",
};

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(null); // holds success payload

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      const { data } = await api.post("auth/register/", form);
      setRegistered(data);
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === "object") {
        setErrors(data);
      } else {
        setErrors({ non_field_errors: ["Something went wrong. Please try again."] });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // --- Success / pending-verification state ---
  if (registered) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="pending-screen">
            <div className="pending-icon">
              <i className="bi bi-hourglass-split" />
            </div>
            <h2 style={{ marginBottom: 8 }}>Almost there!</h2>
            <p className="card-subtitle" style={{ marginBottom: 18 }}>
              Your Zelis Bank account <strong>{registered.account_number}</strong> has been
              created. An admin needs to verify your details before you can log in — this
              usually takes less than a day.
            </p>
            <div className="auth-alert warning" style={{ textAlign: "left" }}>
              <i className="bi bi-info-circle-fill" />
              <span>{registered.message}</span>
            </div>
            <Link to="/login" className="btn btn-primary btn-block" style={{ marginTop: 10 }}>
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card wide">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <i className="bi bi-bank2" />
          </div>
          <span className="auth-brand-text">Zelis Bank</span>
        </div>
        <p className="auth-subtitle">
          Open an account in minutes. Your details are reviewed by an admin before activation.
        </p>

        {errors.non_field_errors && (
          <div className="auth-alert error">
            <i className="bi bi-exclamation-triangle-fill" />
            <span>{errors.non_field_errors[0]}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input
                name="first_name"
                className="form-control"
                value={form.first_name}
                onChange={handleChange}
                required
              />
              {errors.first_name && <p className="form-error">{errors.first_name[0]}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input
                name="last_name"
                className="form-control"
                value={form.last_name}
                onChange={handleChange}
                required
              />
              {errors.last_name && <p className="form-error">{errors.last_name[0]}</p>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                name="username"
                className="form-control"
                value={form.username}
                onChange={handleChange}
                required
              />
              {errors.username && <p className="form-error">{errors.username[0]}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                name="email"
                className="form-control"
                value={form.email}
                onChange={handleChange}
                required
              />
              {errors.email && <p className="form-error">{errors.email[0]}</p>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                name="phone_number"
                className="form-control"
                placeholder="07XXXXXXXX"
                value={form.phone_number}
                onChange={handleChange}
                required
              />
              {errors.phone_number && <p className="form-error">{errors.phone_number[0]}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">National ID Number</label>
              <input
                name="id_number"
                className="form-control"
                value={form.id_number}
                onChange={handleChange}
                required
              />
              {errors.id_number && <p className="form-error">{errors.id_number[0]}</p>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                name="password"
                className="form-control"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
              {errors.password && <p className="form-error">{errors.password[0]}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                name="confirm_password"
                className="form-control"
                value={form.confirm_password}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
              {errors.confirm_password && (
                <p className="form-error">{errors.confirm_password[0]}</p>
              )}
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? (
              <>
                <LoadingSpinner size="sm" /> Creating account...
              </>
            ) : (
              <>
                <i className="bi bi-person-plus-fill" /> Create Account
              </>
            )}
          </button>
        </form>

        <p className="auth-footer-text">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}