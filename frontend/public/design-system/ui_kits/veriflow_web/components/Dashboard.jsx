/* global React, Panel, Button, Badge, Icon, FieldLabel, RiskChip, VF_DATA, ChainOfCustody3D */
const { useState: useStateDash, useEffect: useEffectDash, useRef: useRefDash } = React;

function LivePill() {
  const [stale, setStale] = useStateDash(false);
  return (
    <Badge tone={stale ? "stale" : "live"} pulse={!stale} caps
      onClick={() => setStale(s => !s)}
    >
      {stale ? "Stale" : "Live"}
    </Badge>
  );
}

function KPI({ label, value, delta, tone, icon, alert }) {
  // simple count-up on mount
  const [n, setN] = useStateDash(0);
  const ref = useRefDash(null);
  useEffectDash(() => {
    const dur = 700, start = performance.now(), target = value;
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <div style={{
      position: "relative", background: "var(--surface-panel)",
      border: `1px solid ${alert ? "rgba(239,68,68,.5)" : "var(--surface-border)"}`,
      borderRadius: 8, padding: "14px 16px", minHeight: 92,
    }}>
      <FieldLabel>{label}</FieldLabel>
      <div className="display" style={{ fontSize: 34, lineHeight: 1, marginTop: 6, color: alert ? "var(--severity-critical)" : "var(--text)" }}>
        {n.toLocaleString()}
      </div>
      {delta && (
        <div className="mono" style={{ fontSize: 11, marginTop: 6, color: "var(--text-muted)" }}>
          <span style={{ color: tone === "up" ? "var(--severity-low)" : tone === "down" ? "var(--severity-critical)" : "var(--text-muted)" }}>
            {tone === "up" ? "▲" : tone === "down" ? "▼" : "■"} {delta.change}
          </span>
          {" · "}{delta.window}
        </div>
      )}
      {icon && (
        <div style={{ position: "absolute", top: 12, right: 12, color: alert ? "var(--severity-critical)" : "var(--brand-400)", opacity: alert ? .7 : .55 }}>
          <Icon name={icon} size={18}/>
        </div>
      )}
    </div>
  );
}

function NeedsAttentionTable({ onOpen }) {
  const rows = VF_DATA.records.filter(r => r.status === "blocked" || r.risk >= 60).slice(0, 5);
  return (
    <Panel
      title="Needs attention"
      padded={false}
      action={<Button variant="ghost" size="sm" icon="refresh">Refresh</Button>}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ color: "var(--text-subtle)", fontSize: 11, letterSpacing: ".04em", textTransform: "uppercase" }}>
            <th style={th}>Reference</th>
            <th style={th}>Subject</th>
            <th style={th}>Stage</th>
            <th style={th}>Risk</th>
            <th style={th}>Status</th>
            <th style={{ ...th, textAlign: "right" }}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} onClick={() => onOpen(r.id)} style={{
              cursor: "pointer", borderTop: "1px solid var(--surface-border)",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface-muted)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <td style={{ ...td, fontFamily: "var(--font-mono)", color: "var(--brand-300)" }}>{r.id}</td>
              <td style={td}>{r.subject}</td>
              <td style={{ ...td, color: "var(--text-muted)" }}>{VF_DATA.stages.find(s => s.id === r.stage).label}</td>
              <td style={td}><RiskChip value={r.risk}/></td>
              <td style={td}><Badge tone={r.status === "blocked" ? "blocked" : "progress"} pulse={r.status === "blocked"}>
                {r.status === "blocked" ? "Blocked" : "In progress"}
              </Badge></td>
              <td style={{ ...td, textAlign: "right", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{r.updated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
const th = { textAlign: "left", padding: "10px 16px", fontWeight: 500 };
const td = { padding: "12px 16px", verticalAlign: "middle" };

function Dashboard({ onOpenRecord }) {
  return (
    <div className="vf-rise">
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 className="display" style={{ margin: 0, fontSize: 30, lineHeight: 1.1 }}>Operations overview</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Live summary of records moving through the active workflow.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LivePill/>
          <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>
            polled 14s ago
          </span>
        </div>
      </div>

      <div className="vf-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <KPI label="Active records"   value={247} delta={{ change: "+ 8",   window: "24h" }}        tone="up"   icon="activity"/>
        <KPI label="Blocked"           value={6}   delta={{ change: "+ 2",   window: "vs yesterday"}} tone="up"   icon="alertOct" alert/>
        <KPI label="Median risk"       value={41}  delta={{ change: "− 1.4", window: "7d trend" }}  tone="down" icon="shield"/>
        <KPI label="Evaluated · 24h"   value={892} delta={{ change: "+ 34",  window: "vs avg" }}    tone="up"   icon="circleChk"/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div className="vf-rise"><NeedsAttentionTable onOpen={onOpenRecord}/></div>
        <div className="vf-scale" style={{ animationDelay: ".15s" }}>
          <Panel title="Evidence chain" padded={false}
            action={<span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>live · 41,829 rows</span>}>
            <ChainOfCustody3D/>
          </Panel>
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
