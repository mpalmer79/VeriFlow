/* global React */
const { useState } = React;

// --- Icon ---------------------------------------------------------------
// Inline SVG paths from the VeriFlow Lucide subset, so the kit has zero deps.
const ICON_PATHS = {
  activity:   <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
  alertOct:   <g><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></g>,
  alertTri:   <g><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></g>,
  arrow:      <g><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></g>,
  check:      <polyline points="20 6 9 17 4 12"/>,
  chev:       <polyline points="9 18 15 12 9 6"/>,
  circle:     <circle cx="12" cy="12" r="10"/>,
  circleChk:  <g><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></g>,
  clock:      <g><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></g>,
  copy:       <g><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></g>,
  ext:        <g><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></g>,
  fileOk:     <g><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></g>,
  fileX:      <g><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="19"/><line x1="15" y1="13" x2="9" y2="19"/></g>,
  link2:      <g><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/></g>,
  loader:     <g><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></g>,
  more:       <g><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></g>,
  refresh:    <g><polyline points="23 4 23 10 17 10"/><path d="M20.49 15A9 9 0 1 1 5.64 5.64L23 10"/></g>,
  shield:     <g><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></g>,
  fingerprint:<g><path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12 3c-1.92 0-3.79.5-5.51 1.51-.23.13-.53.08-.67-.13-.14-.21-.09-.51.11-.65C7.74 2.65 9.81 2 12 2c2.14 0 4.16.5 6.31 1.66.24.12.34.42.22.66-.09.16-.25.25-.43.25"/><path d="M3.5 9.72a.5.5 0 0 1-.41-.79c.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.25a.5.5 0 0 1-.82.58c-.9-1.26-2.04-2.25-3.39-2.94-2.87-1.47-6.54-1.47-9.4.01-1.36.7-2.5 1.7-3.4 2.96a.5.5 0 0 1-.39.21"/></g>,
};
function Icon({ name, size = 16, strokeWidth = 1.75, color = "currentColor", className = "", style = {} }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size} height={size}
      fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, ...style }}
    >{ICON_PATHS[name]}</svg>
  );
}

// --- Button -------------------------------------------------------------
const btnBase = {
  display: "inline-flex", alignItems: "center", gap: 6,
  fontFamily: "inherit", fontSize: 13, fontWeight: 500,
  padding: "8px 14px", borderRadius: 6, border: "1px solid transparent",
  cursor: "pointer", transition: "background 120ms ease-out, border-color 120ms ease-out, color 120ms ease-out",
};
const btnVariants = {
  primary:   { background: "var(--brand-600)", color: "#fff" },
  secondary: { background: "transparent", color: "var(--text)", borderColor: "var(--surface-border)" },
  ghost:     { background: "transparent", color: "var(--text)" },
  danger:    { background: "transparent", color: "var(--severity-critical)", borderColor: "rgba(239,68,68,.4)" },
};
function Button({ variant = "primary", size = "md", icon, children, onClick, style = {}, ...rest }) {
  const [h, setH] = useState(false);
  const [p, setP] = useState(false);
  const v = btnVariants[variant];
  const sz = size === "sm" ? { padding: "5px 10px", fontSize: 12 } : {};
  const hover = {
    primary:   h ? { background: "var(--brand-500)" } : {},
    secondary: h ? { borderColor: "var(--text-subtle)" } : {},
    ghost:     h ? { background: "var(--surface-muted)" } : {},
    danger:    h ? { background: "rgba(239,68,68,.1)", borderColor: "var(--severity-critical)" } : {},
  }[variant];
  return (
    <button
      style={{ ...btnBase, ...v, ...sz, ...hover, transform: p ? "translateY(1px)" : "translateY(0)", ...style }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => { setH(false); setP(false); }}
      onMouseDown={() => setP(true)} onMouseUp={() => setP(false)}
      onClick={onClick} {...rest}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 12 : 14} />}
      {children}
    </button>
  );
}

// --- Panel --------------------------------------------------------------
function Panel({ title, action, children, padded = true, style = {}, tone }) {
  const border = tone ? `1px solid ${tone}` : "1px solid var(--surface-border)";
  return (
    <section style={{
      background: "var(--surface-panel)", border, borderRadius: 8,
      overflow: "hidden", ...style,
    }}>
      {(title || action) && (
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: "1px solid var(--surface-border)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
          {action}
        </header>
      )}
      <div style={{ padding: padded ? 16 : 0 }}>{children}</div>
    </section>
  );
}

// --- FieldLabel + small text helpers -----------------------------------
function FieldLabel({ children, style = {} }) {
  return <div style={{
    fontSize: 11, letterSpacing: ".04em", textTransform: "uppercase",
    color: "var(--text-subtle)", fontWeight: 500, ...style,
  }}>{children}</div>;
}

// --- Badge --------------------------------------------------------------
const BADGE_TONES = {
  pending:  { color: "var(--text-muted)",       bg: "var(--surface-muted)",    bd: "var(--surface-border)" },
  progress: { color: "var(--accent-400)",       bg: "rgba(59,130,246,.15)",    bd: "rgba(59,130,246,.4)" },
  blocked:  { color: "var(--severity-critical)",bg: "rgba(239,68,68,.13)",     bd: "rgba(239,68,68,.4)" },
  verified: { color: "var(--severity-verified)",bg: "rgba(20,184,166,.13)",    bd: "rgba(20,184,166,.4)" },
  rejected: { color: "var(--severity-rejected)",bg: "rgba(180,83,9,.15)",      bd: "rgba(180,83,9,.4)" },
  closed:   { color: "var(--text-muted)",       bg: "var(--surface-panel)",    bd: "var(--surface-border)" },
  live:     { color: "var(--severity-low)",     bg: "rgba(34,197,94,.12)",     bd: "rgba(34,197,94,.4)" },
  stale:    { color: "var(--severity-moderate)",bg: "rgba(234,179,8,.12)",     bd: "rgba(234,179,8,.4)" },
};
function Badge({ tone = "pending", children, pulse, caps }) {
  const t = BADGE_TONES[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: caps ? "3px 8px" : "3px 9px", borderRadius: 999,
      fontSize: caps ? 11 : 12, fontWeight: caps ? 600 : 500,
      letterSpacing: caps ? ".08em" : 0, textTransform: caps ? "uppercase" : "none",
      color: t.color, background: t.bg, border: `1px solid ${t.bd}`,
    }}>
      <span className={pulse ? "pulse" : ""} style={{
        width: 7, height: 7, borderRadius: 999, background: t.color,
      }}/>
      {children}
    </span>
  );
}

// --- RiskChip -----------------------------------------------------------
function riskTone(v) {
  if (v < 25) return { c: "var(--severity-low)",      bg: "rgba(34,197,94,.13)",  bd: "rgba(34,197,94,.4)" };
  if (v < 50) return { c: "var(--severity-moderate)", bg: "rgba(234,179,8,.13)",  bd: "rgba(234,179,8,.4)" };
  if (v < 75) return { c: "var(--severity-high)",     bg: "rgba(249,115,22,.13)", bd: "rgba(249,115,22,.4)" };
  return            { c: "var(--severity-critical)", bg: "rgba(239,68,68,.13)",  bd: "rgba(239,68,68,.4)" };
}
function RiskChip({ value }) {
  const t = riskTone(value);
  return (
    <span className="mono" style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 9px", borderRadius: 999, fontSize: 12, fontWeight: 600,
      color: t.c, background: t.bg, border: `1px solid ${t.bd}`,
    }}>Risk {String(value).padStart(2, "0")}</span>
  );
}

// --- Toast --------------------------------------------------------------
function Toast({ tone = "info", children, onClose }) {
  const toneMap = {
    info:    { c: "var(--accent-400)",        b: "rgba(59,130,246,.4)" },
    ok:      { c: "var(--severity-verified)", b: "rgba(20,184,166,.4)" },
    warn:    { c: "var(--severity-moderate)", b: "rgba(234,179,8,.4)" },
    error:   { c: "var(--severity-critical)", b: "rgba(239,68,68,.4)" },
  }[tone];
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      background: "var(--surface-panel)", border: `1px solid ${toneMap.b}`,
      borderRadius: 8, padding: "8px 12px", boxShadow: "var(--shadow-lg)",
      fontSize: 13,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: toneMap.c }}/>
      <span>{children}</span>
      {onClose && <button onClick={onClose} style={{ background:"transparent", border:0, color:"var(--text-muted)", cursor:"pointer", fontSize:14, padding:0, marginLeft:4 }}>×</button>}
    </div>
  );
}

// --- Logomark -----------------------------------------------------------
function Logomark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      stroke="var(--brand-400)" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 9 L14 24 L16 21"/>
      <path d="M12 9 L21 24 L27 13"/>
    </svg>
  );
}

Object.assign(window, { Icon, Button, Panel, FieldLabel, Badge, RiskChip, Toast, Logomark, riskTone });
