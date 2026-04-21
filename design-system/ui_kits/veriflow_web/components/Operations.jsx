/* global React, Panel, Button, Badge, Icon, FieldLabel */
const { useState: useStateOps } = React;

function Operations({ pushToast }) {
  const [verified, setVerified] = useStateOps(null);
  const verify = () => {
    setVerified("running");
    setTimeout(() => {
      setVerified("ok");
      pushToast("ok", "Audit chain verified · 41 rows, 0 breaks");
    }, 1200);
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="display" style={{ margin: 0, fontSize: 30, lineHeight: 1.1 }}>Operations</h1>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Admin-only verification, storage inventory, and orphan cleanup.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Panel title="Audit chain" padded
          action={<Button size="sm" icon={verified === "running" ? "loader" : "shield"} onClick={verify} disabled={verified === "running"}>
            {verified === "running" ? "Verifying…" : "Verify now"}
          </Button>}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Metric label="Rows" value="41,829"/>
            <Metric label="Last break" value="—" mono/>
          </div>
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 6,
            background: verified === "ok" ? "rgba(20,184,166,.08)" : "var(--surface-muted)",
            border: `1px solid ${verified === "ok" ? "rgba(20,184,166,.4)" : "var(--surface-border)"}`,
            fontSize: 12, display: "flex", alignItems: "center", gap: 8,
          }}>
            <Icon name={verified === "ok" ? "circleChk" : "clock"} size={14}
                  color={verified === "ok" ? "var(--severity-verified)" : "var(--text-muted)"}/>
            {verified === "ok"
              ? <span>Chain intact. No hash mismatches across 41,829 rows.</span>
              : verified === "running"
                ? <span>Re-hashing rows…</span>
                : <span>Last verified 02:14 ago. Run again to refresh.</span>}
          </div>
        </Panel>

        <Panel title="Managed storage" padded>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Metric label="Objects" value="12,481"/>
            <Metric label="Size" value="84.2 GB" mono/>
            <Metric label="Orphans" value="7" tone="warn"/>
            <Metric label="Pending GC" value="0"/>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <Button variant="secondary" size="sm" icon="refresh">Re-scan</Button>
            <Button variant="danger" size="sm">Clean 7 orphans</Button>
          </div>
        </Panel>
      </div>

      <Panel title="Workflows" padded>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--text-subtle)", fontSize: 11, letterSpacing: ".04em", textTransform: "uppercase" }}>
              <th style={tho}>ID</th>
              <th style={tho}>Version</th>
              <th style={tho}>Active records</th>
              <th style={tho}>Status</th>
              <th style={{ ...tho, textAlign: "right" }}>Last published</th>
            </tr>
          </thead>
          <tbody>
            {[
              { id: "healthcare_intake", v: 14, a: 247, status: "active", when: "2 days ago" },
              { id: "loan_intake",       v: 8,  a: 112, status: "active", when: "12 days ago" },
              { id: "vendor_onboarding", v: 3,  a: 0,   status: "draft",  when: "—" },
            ].map(w => (
              <tr key={w.id} style={{ borderTop: "1px solid var(--surface-border)" }}>
                <td style={{ ...tdo, fontFamily: "var(--font-mono)", color: "var(--brand-300)" }}>{w.id}</td>
                <td style={{ ...tdo, fontFamily: "var(--font-mono)" }}>v{w.v}</td>
                <td style={tdo}>{w.a.toLocaleString()}</td>
                <td style={tdo}>{w.status === "active" ? <Badge tone="verified">Active</Badge> : <Badge tone="pending">Draft</Badge>}</td>
                <td style={{ ...tdo, textAlign: "right", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{w.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function Metric({ label, value, tone, mono }) {
  const color = tone === "warn" ? "var(--severity-moderate)" : "var(--text)";
  return (
    <div style={{ padding: "10px 12px", borderRadius: 6, background: "var(--surface-muted)", border: "1px solid var(--surface-border)" }}>
      <FieldLabel>{label}</FieldLabel>
      <div className={mono ? "mono" : "display"} style={{ marginTop: 4, fontSize: mono ? 16 : 24, color, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}
const tho = { textAlign: "left", padding: "8px 12px", fontWeight: 500 };
const tdo = { padding: "10px 12px" };

window.Operations = Operations;
