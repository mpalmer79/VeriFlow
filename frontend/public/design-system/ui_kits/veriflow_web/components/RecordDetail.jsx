/* global React, Panel, Button, Badge, Icon, FieldLabel, RiskChip, Toast, VF_DATA, riskTone */
const { useState: useStateDet, useEffect: useEffectDet } = React;

// 9-stage node timeline with advance animation
function Timeline({ activeId, blockedId }) {
  const targetIdx = VF_DATA.stages.findIndex(s => s.id === activeId);
  const blockedIdx = VF_DATA.stages.findIndex(s => s.id === blockedId);
  const [cursor, setCursor] = useStateDet(0);
  useEffectDet(() => {
    let raf, t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 1400);
      const eased = 1 - Math.pow(1 - p, 3);
      setCursor(eased * targetIdx);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [targetIdx]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
        {VF_DATA.stages.map((s, i) => {
          const state = blockedIdx === i && cursor >= targetIdx - 0.02 ? "blocked"
                      : i < Math.floor(cursor) ? "done"
                      : i === Math.floor(cursor) && cursor < targetIdx ? "travel"
                      : i === targetIdx ? "active"
                      : "future";
          const dotBg = state === "done" ? "var(--severity-verified)"
                      : state === "active" ? "var(--brand-600)"
                      : state === "blocked" ? "var(--severity-critical)"
                      : "var(--surface-muted)";
          const ring = state === "active" ? "0 0 0 3px rgba(61,171,196,.3)" : "none";
          const shape = state === "blocked" ? { borderRadius: 2, width: 12, height: 12 } : { borderRadius: 999, width: 14, height: 14 };
          const lineFrac = i > 0 ? Math.max(0, Math.min(1, cursor - (i - 1))) : 0;
          return (
            <div key={s.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative" }}>
              {i > 0 && (
                <>
                  <div style={{ position: "absolute", left: "-50%", right: "50%", top: 7, height: 1, background: "var(--surface-border)" }}/>
                  <div style={{ position: "absolute", left: "-50%", top: 7, height: 1, width: `${lineFrac * 100}%`, background: "var(--severity-verified)", transition: "width .3s var(--ease-out-expo)" }}/>
                </>
              )}
              <div style={{ position: "relative", zIndex: 1, ...shape, background: dotBg, border: `1px solid ${dotBg}`, boxShadow: ring, transition: "all .3s var(--ease-out-expo)" }}/>
              <div style={{
                fontSize: 10, color: state === "active" ? "var(--text)" : state === "blocked" ? "var(--severity-critical)" : "var(--text-muted)",
                fontWeight: state === "active" ? 600 : 400, textAlign: "center", maxWidth: 80, lineHeight: 1.2,
              }}>{s.label}</div>
            </div>
          );
        })}
        {/* traveling record puck */}
        <div style={{
          position: "absolute", top: 0, left: `${(cursor / (VF_DATA.stages.length - 1)) * 100}%`,
          transform: "translateX(-50%)", pointerEvents: "none",
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: 999,
            background: "radial-gradient(circle, var(--brand-300), var(--brand-600))",
            boxShadow: "0 0 20px rgba(61,171,196,.8), 0 0 40px rgba(61,171,196,.4)",
            transform: "translateY(-3px)",
          }}/>
        </div>
      </div>
      <div className="mono" style={{ display: "flex", gap: 16, marginTop: 20, fontSize: 11, color: "var(--text-muted)" }}>
        <span>workflow · healthcare_intake v14</span>
        <span>stage · {Math.floor(cursor) + 1} of {VF_DATA.stages.length}</span>
        <span>elapsed · 02:41:18</span>
      </div>
    </div>
  );
}

function RiskBar({ value }) {
  const t = riskTone(value);
  const [n, setN] = useStateDet(0);
  useEffectDet(() => {
    let raf, t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 900);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <FieldLabel>Risk score</FieldLabel>
        <div className="mono" style={{ fontSize: 12, color: t.c, fontWeight: 600 }}>{n}/100</div>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "var(--surface-muted)", overflow: "hidden", position: "relative" }}>
        <div style={{ width: `${n}%`, height: "100%", background: t.c, transition: "width 120ms linear", position: "relative" }}>
          <div className="vf-shimmer" style={{ position: "absolute", inset: 0 }}/>
        </div>
        <div style={{ position: "absolute", inset: 0, width: `${n}%`, background: t.c, opacity: .22, filter: "blur(10px)", pointerEvents: "none" }}/>
      </div>
    </div>
  );
}

function SeverityList({ tone, issues, emptyMsg, baseDelay = 0 }) {
  const toneMap = {
    blocking: { c: "var(--severity-critical)", title: "Blocking" },
    warning:  { c: "var(--severity-moderate)", title: "Warnings" },
  }[tone];
  const [n, setN] = useStateDet(0);
  useEffectDet(() => {
    let raf, t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 700);
      setN(Math.round(issues.length * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [issues.length]);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: toneMap.c, position: "relative", paddingBottom: 4 }}>
          {toneMap.title}
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 0, height: 2,
            background: toneMap.c, transformOrigin: "left",
            animation: `vf-sev-sweep .6s ${baseDelay}s var(--ease-out-expo) both`,
          }}/>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{n} {issues.length === 1 ? "issue" : "issues"}</div>
      </div>
      {issues.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 4px", animation: `vf-fade-in .5s ${baseDelay + .2}s both` }}>{emptyMsg}</div>
      )}
      {issues.map((iss, i) => {
        const color = {
          critical: "var(--severity-critical)", high: "var(--severity-high)",
          moderate: "var(--severity-moderate)", low: "var(--severity-low)",
        }[iss.severity];
        const bg = {
          critical: "rgba(239,68,68,.08)", high: "rgba(249,115,22,.08)",
          moderate: "rgba(234,179,8,.08)", low: "rgba(34,197,94,.08)",
        }[iss.severity];
        return (
          <div key={iss.code} style={{
            display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px",
            marginTop: 4, borderRadius: 6, background: bg, fontSize: 12, lineHeight: 1.45,
            borderLeft: `2px solid ${color}`,
            animation: `vf-slide-in-${tone === "blocking" ? "left" : "right"} .45s ${baseDelay + .15 + i * .08}s var(--ease-out-expo) both`,
          }}>
            <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, color, cursor: "pointer" }}
                  title="Copy rule code" onClick={() => navigator.clipboard?.writeText(iss.code)}>
              {iss.code}
            </code>
            <span style={{ color: "var(--text)", opacity: .9, flex: 1 }}>{iss.message}</span>
          </div>
        );
      })}
    </div>
  );
}

function EvidenceList() {
  return (
    <div>
      {VF_DATA.evidence.map(ev => {
        const tone = ev.status === "verified" ? "verified" : ev.status === "rejected" ? "rejected" : "pending";
        const icon = ev.status === "verified" ? "fileOk" : ev.status === "rejected" ? "fileX" : "fileOk";
        return (
          <div key={ev.id} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
            borderTop: "1px solid var(--surface-border)",
          }}>
            <Icon name={icon} size={18} color={tone === "verified" ? "var(--severity-verified)" : tone === "rejected" ? "var(--severity-rejected)" : "var(--text-muted)"}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13 }}>{ev.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                <span className="mono">{ev.hash}</span> · uploaded {ev.uploaded}
                {ev.note && <> · <span style={{ color: "var(--severity-rejected)" }}>{ev.note}</span></>}
              </div>
            </div>
            <Badge tone={tone}>{ev.status[0].toUpperCase() + ev.status.slice(1)}</Badge>
            <button style={{ background:"transparent", border:0, color:"var(--text-muted)", cursor:"pointer", padding:4 }}><Icon name="more"/></button>
          </div>
        );
      })}
    </div>
  );
}

function AuditTrail() {
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
      {VF_DATA.audit.map((a) => (
        <div key={a.n} style={{
          display: "grid", gridTemplateColumns: "40px 70px 100px 1fr auto",
          gap: 10, padding: "7px 0", borderTop: "1px solid var(--surface-border)",
          color: "var(--text-muted)", alignItems: "center",
        }}>
          <span style={{ color: "var(--text-subtle)" }}>#{a.n}</span>
          <span>{a.at}</span>
          <span style={{ color: "var(--text)" }}>{a.actor}</span>
          <span style={{ color: "var(--brand-300)" }}>{a.action} <span style={{ color: "var(--text-muted)" }}>→ {a.ref}</span></span>
          <span title={`prev ${a.prev} · hash ${a.hash}`} style={{ color: "var(--text-subtle)" }}>{a.hash}</span>
        </div>
      ))}
    </div>
  );
}

function RecordDetail({ id, onBack, pushToast }) {
  const rec = VF_DATA.records.find(r => r.id === id) || VF_DATA.records[0];
  const [evaluating, setEvaluating] = useStateDet(false);
  const runEval = () => {
    setEvaluating(true);
    setTimeout(() => { setEvaluating(false); pushToast("ok", "Evaluation complete · 2 blocking, 2 warnings"); }, 900);
  };
  return (
    <div className="vf-rise">
      <button onClick={onBack} style={{
        background: "transparent", border: 0, color: "var(--text-muted)",
        fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 12,
        display: "inline-flex", alignItems: "center", gap: 6,
      }}>
        <Icon name="chev" size={12} style={{ transform: "rotate(180deg)" }}/> Back to records
      </button>

      {/* Header */}
      <Panel padded style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span className="mono" style={{ fontSize: 13, color: "var(--brand-300)" }}>{rec.id}</span>
              <Badge tone="blocked" pulse>Blocked</Badge>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>v{rec.version}</span>
            </div>
            <h1 className="display" style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>{rec.subject}</h1>
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              Assigned to {rec.assignee} · last activity {rec.updated}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" icon="copy" size="sm">Copy ref</Button>
            <Button variant="secondary" icon="arrow" size="sm">Attempt transition</Button>
            <Button icon={evaluating ? "loader" : "refresh"} onClick={runEval} disabled={evaluating}>
              <span className={evaluating ? "spin" : ""} style={{ display:"none" }}/>
              {evaluating ? "Running…" : "Run evaluation"}
            </Button>
          </div>
        </div>
      </Panel>

      {/* Timeline */}
      <Panel padded style={{ marginBottom: 16 }} className="vf-rise">
        <Timeline activeId="coverage" blockedId="coverage"/>
      </Panel>

      {/* Evaluation + risk */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 16 }}>
        <Panel title="Risk + score" padded>
          <RiskBar value={rec.risk}/>
          <div style={{ marginTop: 20 }}>
            <FieldLabel style={{ marginBottom: 6 }}>Current stage</FieldLabel>
            <div style={{ fontSize: 14 }}>{VF_DATA.stages.find(s => s.id === rec.stage).label}</div>
          </div>
          <div style={{ marginTop: 16 }}>
            <FieldLabel style={{ marginBottom: 6 }}>Rule set</FieldLabel>
            <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--brand-300)" }}>healthcare_intake · v14</code>
          </div>
        </Panel>
        <Panel title="Evaluation" padded action={<span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>evaluated 0:12s ago</span>}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <SeverityList tone="blocking" issues={VF_DATA.blocking} baseDelay={0}
              emptyMsg="No blocking issues. All block-level rules passed."/>
            <SeverityList tone="warning" issues={VF_DATA.warnings} baseDelay={0.25}
              emptyMsg="Nothing flagged."/>
          </div>
        </Panel>
      </div>

      {/* Evidence + audit */}
      <div className="vf-stagger" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="Evidence" padded action={<Button variant="ghost" size="sm" icon="arrow">Upload</Button>}>
          <EvidenceList/>
        </Panel>
        <Panel title="Audit trail" padded action={<Button variant="ghost" size="sm" icon="shield">Verify chain</Button>}>
          <AuditTrail/>
        </Panel>
      </div>
    </div>
  );
}

window.RecordDetail = RecordDetail;
