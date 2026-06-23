import { useEffect, useRef, useState } from "react";
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

export default function SendMoney() {
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [narrative, setNarrative] = useState("");

  // lookupState: "idle" | "checking" | "found" | "not-found"
  const [lookupState, setLookupState] = useState("idle");
  const [recipient, setRecipient] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const debounceRef = useRef(null);

  // --- Debounced real-time recipient lookup ---
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = accountNumber.trim();
    if (trimmed.length < 6) {
      setLookupState("idle");
      setRecipient(null);
      return;
    }

    setLookupState("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get("accounts/lookup/", {
          params: { account_number: trimmed },
        });
        if (data.exists) {
          setLookupState("found");
          setRecipient(data);
        } else {
          setLookupState("not-found");
          setRecipient(null);
        }
      } catch {
        setLookupState("not-found");
        setRecipient(null);
      }
    }, 600);

    return () => clearTimeout(debounceRef.current);
  }, [accountNumber]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(null);

    if (lookupState !== "found") {
      setError("Please enter a valid, verified recipient account number.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post("transactions/send/", {
        account_number: accountNumber.trim(),
        amount,
        narrative,
      });
      setSuccess(data);
      setAccountNumber("");
      setAmount("");
      setNarrative("");
      setLookupState("idle");
      setRecipient(null);
    } catch (err) {
      const data = err?.response?.data;
      setError(
        data?.detail ||
          data?.amount?.[0] ||
          data?.account_number?.[0] ||
          data?.non_field_errors?.[0] ||
          "Could not complete the transfer. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout title="Send Money">
      <div className="page-header">
        <div>
          <h1 className="page-title">Send Money</h1>
          <p className="page-subtitle">
            Transfer instantly to any Zelis Bank account number.
          </p>
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
              <i className="bi bi-check-circle-fill" /> {success.detail}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Recipient Account Number</label>
              <div className="input-icon-group">
                <i className="bi bi-credit-card-2-front-fill" />
                <input
                  className="form-control"
                  placeholder="e.g. 2200145821"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  maxLength={10}
                  required
                />
              </div>

              {lookupState === "checking" && (
                <div className="recipient-preview checking">
                  <LoadingSpinner size="sm" /> Checking account...
                </div>
              )}
              {lookupState === "found" && recipient && (
                <div className="recipient-preview found">
                  <div className="recipient-avatar">
                    {recipient.account_holder?.[0] || "?"}
                  </div>
                  <span>
                    <i className="bi bi-check-circle-fill" /> Sending to{" "}
                    <strong>{recipient.account_holder}</strong> ({recipient.account_number})
                  </span>
                </div>
              )}
              {lookupState === "not-found" && (
                <div className="recipient-preview not-found">
                  <i className="bi bi-x-circle-fill" /> No active account found with that number.
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Amount (KES)</label>
              <div className="input-icon-group">
                <i className="bi bi-cash-stack" />
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
            </div>

            <div className="form-group">
              <label className="form-label">Narrative (optional)</label>
              <input
                className="form-control"
                placeholder="e.g. Rent, school fees, lunch money"
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                maxLength={255}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={submitting || lookupState !== "found"}
            >
              {submitting ? (
                <>
                  <LoadingSpinner size="sm" /> Sending...
                </>
              ) : (
                <>
                  <i className="bi bi-send-fill" /> Send Money
                </>
              )}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <i className="bi bi-shield-check" /> How this works
            </div>
          </div>
          <p className="card-subtitle" style={{ lineHeight: 1.7 }}>
            As you type an account number, Zelis Bank checks it in real time and shows you
            who you're about to pay — before you confirm. This protects you from sending
            money to the wrong person. Transfers are instant and irreversible, so always
            confirm the recipient name matches who you intend to pay.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}