/* global React, Panel, Badge, RiskChip, Icon, Button, FieldLabel, VF_DATA */
const { useState: useStateRec } = React;

function Records({ onOpenRecord }) {
  const [q, setQ] = useStateRec("");
  const [stage, setStage] = useStateRec("all");
  const [status, setStatus] = useStateRec("all");

  const filtered = VF_DATA.records.filter(r => {
    if (stage !== "all" && r.stage !== stage) return false;
    if (status !== "all" && r.status !== status) return false;
    if (q && !(r.id.toLowerCase().includes(q.toLowerCase()) || r.subject.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 className="display" style={{ margin: 0, fontSize: 30, lineHeight: 1.1 }}>Records</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {filtered.length} of {VF_DATA.records.length} · workflow <span className="mono">healthcare_intake v14</span>
          </div>
        </div>
        <Button icon="arrow">New record</Button>
      </div>

      <Panel padded={false}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderBottom: "1px solid var(--surface-border)" }}>
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search by reference or subject…"
            style={filterInput}
          />
          <select value={stage} onChange={e => setStage(e.target.value)} style={filterSelect}>
            <option value="all">All stages</option>
            {VF_DATA.stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} style={filterSelect}>
            <option value="all">Any status</option>
            <option value="progress">In progress</option>
            <option value="blocked">Blocked</option>
            <option value="closed">Closed</option>
          </select>
          <div style={{ flex: 1 }}/>
          <Button variant="secondary" size="sm" icon="refresh">Refresh</Button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--text-subtle)", fontSize: 11, letterSpacing: ".04em", textTransform: "uppercase" }}>
              <th style={th2}>Reference</th>
              <th style={th2}>Subject</th>
              <th style={th2}>Stage</th>
              <th style={th2}>Risk</th>
              <th style={th2}>Status</th>
              <th style={th2}>Assignee</th>
              <th style={{ ...th2, textAlign: "right" }}>Updated</th>
              <th style={{ ...th2, width: 40 }}/>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} onClick={() => onOpenRecord(r.id)} style={{ cursor: "pointer", borderTop: "1px solid var(--surface-border)" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface-muted)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ ...td2, fontFamily: "var(--font-mono)", color: "var(--brand-300)" }}>{r.id}</td>
                <td style={td2}>{r.subject}</td>
                <td style={{ ...td2, color: "var(--text-muted)" }}>{VF_DATA.stages.find(s => s.id === r.stage).label}</td>
                <td style={td2}><RiskChip value={r.risk}/></td>
                <td style={td2}>
                  {r.status === "blocked"  && <Badge tone="blocked" pulse>Blocked</Badge>}
                  {r.status === "progress" && <Badge tone="progress">In progress</Badge>}
                  {r.status === "closed"   && <Badge tone="closed">Closed</Badge>}
                </td>
                <td style={{ ...td2, color: "var(--text-muted)" }}>{r.assignee}</td>
                <td style={{ ...td2, textAlign: "right", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{r.updated}</td>
                <td style={{ ...td2, color: "var(--text-subtle)" }}><Icon name="chev" size={14}/></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ ...td2, textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>
                Nothing matches those filters.
              </td></tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
const th2 = { textAlign: "left", padding: "10px 16px", fontWeight: 500 };
const td2 = { padding: "12px 16px", verticalAlign: "middle" };
const filterInput = {
  background: "var(--surface)", color: "var(--text)",
  border: "1px solid var(--surface-border)", borderRadius: 6,
  padding: "7px 10px", fontSize: 13, width: 280, fontFamily: "inherit", outline: "none",
};
const filterSelect = {
  ...filterInput, width: "auto", paddingRight: 28, appearance: "none",
  backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
  backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
};

window.Records = Records;
