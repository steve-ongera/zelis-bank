import { useState } from "react";
import api from "../api/axios";
import AppLayout from "../components/AppLayout";
import LoadingSpinner from "../components/LoadingSpinner";

const QUICK_AMOUNTS = [500, 1000, 5000, 10000];

function formatKES(value) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export default function Deposit() {
  const [amount, setAmount] = useState("");
  const [narrative, setNarrative] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(null);
    setSubmitting(true);
    try {
      const { data } = await api.post("transactions/deposit/", { amount, narrative });
      setSuccess(data);
      setAmount("");
      setNarrative("");
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.detail || data?.amount?.[0] || "Deposit failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout title="Deposit">
      <div className="page-header">
        <div>
          <h1 className="page-title">Deposit Funds</h1>
          <p className="page-subtitle">Top up your Zelis Bank wallet.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          {error && (
            <div className="alert alert-danger">
              <i className="bi bi-exclamation-triangle-fill" /> {error}
            </div>
          )}
          {success && (
            <div className="alert alert-success">
              <i className="bi bi-check-circle-fill" /> {success.detail} New balance:{" "}
              {formatKES(success.new_balance)}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Amount (KES)</label>
              <div className="input-icon-group">
                <i className="bi bi-cash-coin" />
                <input
                  type="number"
                  className="form-control"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  step="0.01"
                  required
                />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: "6px 14px", fontSize: "0.82rem" }}
                    onClick={() => setAmount(String(q))}
                  >
                    {formatKES(q)}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Narrative (optional)</label>
              <input
                className="form-control"
                placeholder="e.g. Salary top-up"
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                maxLength={255}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? (
                <>
                  <LoadingSpinner size="sm" /> Processing...
                </>
              ) : (
                <>
                  <i className="bi bi-piggy-bank-fill" /> Deposit Now
                </>
              )}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <i className="bi bi-info-circle" /> About deposits
            </div>
          </div>
          <p className="card-subtitle" style={{ lineHeight: 1.7 }}>
            This demo deposit instantly credits your wallet so you can explore Send Money
            and Transactions. In production, this would be replaced with an M-Pesa Daraja
            STK Push prompt — you'd enter your amount, get a prompt on your phone, and your
            balance would only update after Safaricom confirms the payment via callback.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}