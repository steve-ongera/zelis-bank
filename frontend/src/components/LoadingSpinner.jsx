/**
 * LoadingSpinner
 * - fullPage: covers the whole viewport (used on initial auth check)
 * - size "sm": inline small spinner (used inside buttons)
 * - label: optional text shown under the spinner
 */
export default function LoadingSpinner({ fullPage = false, size = "md", label = "" }) {
  if (size === "sm") {
    return <span className="spinner sm" role="status" aria-label="Loading" />;
  }

  return (
    <div className={`spinner-wrap ${fullPage ? "spinner-fullpage" : ""}`}>
      <div className="spinner" role="status" aria-label="Loading" />
      {label ? <p className="card-subtitle">{label}</p> : null}
    </div>
  );
}