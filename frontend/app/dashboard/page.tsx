export default function DashboardPage() {
  return (
    <main style={{ maxWidth: 960, margin: "60px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Dashboard</h1>
      <p style={{ color: "#b6c2cf", marginBottom: 32 }}>
        Records, workflow stage progress, and risk indicators will appear here once the UI
        is wired to the backend.
      </p>

      <section style={panelStyle}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Healthcare Intake (demo workflow)</h2>
        <ol style={{ lineHeight: 1.8, paddingLeft: 20, color: "#cdd9e5" }}>
          <li>New Intake</li>
          <li>Identity Verification</li>
          <li>Insurance Review</li>
          <li>Consent &amp; Authorization</li>
          <li>Clinical History Review</li>
          <li>Provider Triage</li>
          <li>Ready for Scheduling</li>
          <li>Blocked</li>
          <li>Closed</li>
        </ol>
      </section>
    </main>
  );
}

const panelStyle: React.CSSProperties = {
  padding: 24,
  border: "1px solid #30363d",
  borderRadius: 8,
  background: "#0d1117",
};
