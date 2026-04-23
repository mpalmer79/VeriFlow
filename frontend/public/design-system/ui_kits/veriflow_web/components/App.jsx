/* global React, Dashboard, Records, RecordDetail, Operations, Landing, Logomark, Toast, Icon */
const { useState: useStateApp } = React;

function NavLink({ active, label, onClick }) {
  const [h, setH] = useStateApp(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: "transparent", border: 0, color: active ? "var(--text)" : h ? "var(--text)" : "var(--text-muted)",
        padding: "6px 0", fontSize: 13, cursor: "pointer",
        borderBottom: `2px solid ${active ? "var(--brand-400)" : "transparent"}`,
        fontFamily: "inherit", fontWeight: 500,
      }}
    >{label}</button>
  );
}

const PAGE_ORDER = { landing: 0, dashboard: 1, records: 2, detail: 3, ops: 4 };

function App() {
  const [route, setRoute] = useStateApp({ page: "landing" });
  const [toasts, setToasts] = useStateApp([]);
  const [routeKey, setRouteKey] = useStateApp(0);
  const [direction, setDirection] = useStateApp("right");
  const go = (next) => {
    setDirection((PAGE_ORDER[next.page] ?? 0) >= (PAGE_ORDER[route.page] ?? 0) ? "right" : "left");
    setRoute(next);
    setRouteKey(k => k + 1);
  };
  const pushToast = (tone, msg) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(ts => [...ts, { id, tone, msg }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 3600);
  };

  const openRecord = (id) => go({ page: "detail", id });

  return (
    <div style={{ minHeight: "100%", background: "var(--surface)" }}>
      {/* Top nav */}
      <div className="hero-wash" style={{ borderBottom: "1px solid var(--surface-border)" }}>
        <div style={{
          maxWidth: 1280, margin: "0 auto", padding: "14px 32px",
          display: "flex", alignItems: "center", gap: 32,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => go({ page: "landing" })}>
            <Logomark size={22}/>
            <span className="display" style={{ fontSize: 18, letterSpacing: "-.01em" }}>VeriFlow</span>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <NavLink label="Home"       active={route.page === "landing"} onClick={() => go({ page: "landing" })}/>
            <NavLink label="Dashboard"  active={route.page === "dashboard"} onClick={() => go({ page: "dashboard" })}/>
            <NavLink label="Records"    active={route.page === "records" || route.page === "detail"} onClick={() => go({ page: "records" })}/>
            <NavLink label="Operations" active={route.page === "ops"} onClick={() => go({ page: "ops" })}/>
          </nav>
          <div style={{ flex: 1 }}/>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: "var(--text-muted)" }}>
            <span className="mono">env · production</span>
            <span style={{
              width: 28, height: 28, borderRadius: 999,
              background: "linear-gradient(135deg, var(--brand-500), var(--brand-700))",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 11, fontWeight: 600,
            }}>MP</span>
          </div>
        </div>
      </div>

      {/* Page body */}
      {route.page === "landing" ? (
        <div key={routeKey} className="vf-fade"><Landing onEnter={() => go({ page: "dashboard" })}/></div>
      ) : (
        <main key={routeKey} className={direction === "right" ? "vf-slide-r" : "vf-slide-l"} style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 32px 64px" }}>
          {route.page === "dashboard" && <Dashboard onOpenRecord={openRecord}/>}
          {route.page === "records"   && <Records   onOpenRecord={openRecord}/>}
          {route.page === "detail"    && <RecordDetail id={route.id} onBack={() => go({ page: "records" })} pushToast={pushToast}/>}
          {route.page === "ops"       && <Operations pushToast={pushToast}/>}
        </main>
      )}

      {/* Toasts */}
      <div style={{
        position: "fixed", bottom: 20, right: 20, display: "flex",
        flexDirection: "column", gap: 8, zIndex: 50,
      }}>
        {toasts.map(t => <Toast key={t.id} tone={t.tone} onClose={() => setToasts(ts => ts.filter(x => x.id !== t.id))}>{t.msg}</Toast>)}
      </div>
    </div>
  );
}

window.App = App;
