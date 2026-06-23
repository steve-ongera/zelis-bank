import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Link } from "react-router-dom";
import api from "../api/axios";
import AppLayout from "../components/AppLayout";
import LoadingSpinner from "../components/LoadingSpinner";

function formatKES(value) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("dashboard/summary/")
      .then(({ data }) => setSummary(data))
      .catch(() => setError("Could not load your dashboard right now."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppLayout title="Dashboard">
        <LoadingSpinner label="Loading your dashboard..." />
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Dashboard">
        <div className="alert alert-danger">{error}</div>
      </AppLayout>
    );
  }

  const trendData = summary.balance_trend.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en-KE", { day: "numeric", month: "short" }),
  }));

  const monthData = summary.income_vs_expense.map((d) => {
    const [year, month] = d.month.split("-");
    const label = new Date(Number(year), Number(month) - 1).toLocaleDateString("en-KE", {
      month: "short",
    });
    return { ...d, label };
  });

  return (
    <AppLayout title="Dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back 👋</h1>
          <p className="page-subtitle">Here's what's happening with your money.</p>
        </div>
        <Link to="/send-money" className="btn btn-primary">
          <i className="bi bi-send-fill" /> Send Money
        </Link>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon balance">
            <i className="bi bi-wallet2" />
          </div>
          <div>
            <div className="stat-label">Current Balance</div>
            <div className="stat-value">{formatKES(summary.balance)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon income">
            <i className="bi bi-arrow-down-left-circle-fill" />
          </div>
          <div>
            <div className="stat-label">Total Income</div>
            <div className="stat-value">{formatKES(summary.total_income)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon expense">
            <i className="bi bi-arrow-up-right-circle-fill" />
          </div>
          <div>
            <div className="stat-label">Total Sent</div>
            <div className="stat-value">{formatKES(summary.total_expense)}</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Balance Trend</div>
              <div className="card-subtitle">Last 14 days</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid stroke="var(--gray-200)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--gray-500)" }} />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--gray-500)" }}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip formatter={(v) => formatKES(v)} />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="var(--brown-700)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Activity</div>
            </div>
          </div>
          {summary.recent_transactions.length === 0 ? (
            <div className="empty-state">
              <i className="bi bi-inbox" />
              <p>No transactions yet</p>
            </div>
          ) : (
            <div>
              {summary.recent_transactions.map((txn) => (
                <div
                  key={txn.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 0",
                    borderBottom: "1px solid var(--gray-100)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.86rem" }}>
                      {txn.counterparty}
                    </div>
                    <div className="card-subtitle">
                      {new Date(txn.created_at).toLocaleDateString("en-KE", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </div>
                  <span className={txn.direction === "credit" ? "amount-credit" : "amount-debit"}>
                    {txn.direction === "credit" ? "+" : "-"}
                    {formatKES(txn.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Income vs Expense</div>
            <div className="card-subtitle">Last 6 months</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthData}>
            <CartesianGrid stroke="var(--gray-200)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--gray-500)" }} />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--gray-500)" }}
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            />
            <Tooltip formatter={(v) => formatKES(v)} />
            <Legend />
            <Bar dataKey="income" name="Income" fill="var(--success)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="Expense" fill="var(--brown-500)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </AppLayout>
  );
}