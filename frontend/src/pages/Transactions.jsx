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

const TYPE_BADGES = {
  deposit: "badge-success",
  transfer: "badge-neutral",
  withdrawal: "badge-warning",
};

export default function Transactions() {
  const [results, setResults] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  useEffect(() => {
    setLoading(true);
    api
      .get("transactions/", { params: { page } })
      .then(({ data }) => {
        setResults(data.results || data);
        setCount(data.count ?? (data.results || data).length);
      })
      .catch(() => setError("Could not load transactions."))
      .finally(() => setLoading(false));
  }, [page]);

  const filtered =
    filter === "all" ? results : results.filter((t) => t.transaction_type === filter);

  return (
    <AppLayout title="Transactions">
      <div className="page-header">
        <div>
          <h1 className="page-title">Transaction History</h1>
          <p className="page-subtitle">All money movement on your account.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["all", "transfer", "deposit"].map((f) => (
            <button
              key={f}
              className={f === filter ? "btn btn-primary" : "btn btn-secondary"}
              style={{ textTransform: "capitalize", padding: "8px 16px" }}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <LoadingSpinner label="Loading transactions..." />
        ) : error ? (
          <div className="alert alert-danger">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-receipt-cutoff" />
            <p>No transactions found.</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Counterparty</th>
                    <th>Narrative</th>
                    <th>Amount</th>
                    <th>Balance After</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((txn) => (
                    <tr key={txn.id}>
                      <td>
                        {new Date(txn.created_at).toLocaleDateString("en-KE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td>
                        <span className={`badge ${TYPE_BADGES[txn.transaction_type] || "badge-neutral"}`}>
                          {txn.transaction_type}
                        </span>
                      </td>
                      <td>{txn.counterparty}</td>
                      <td>{txn.narrative || "—"}</td>
                      <td className={txn.direction === "credit" ? "amount-credit" : "amount-debit"}>
                        {txn.direction === "credit" ? "+" : "-"}
                        {formatKES(txn.amount)}
                      </td>
                      <td>{formatKES(txn.balance_after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 18,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <span className="card-subtitle">
                Page {page} of {totalPages} &middot; {count} total
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <i className="bi bi-chevron-left" /> Prev
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}