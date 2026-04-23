/* global React, ChainHero3D, Button, Logomark */
const { useState: uSL, useEffect: uEL } = React;

function Landing({ onEnter }) {
  const [entered, setEntered] = uSL(false);
  uEL(() => { const t = setTimeout(() => setEntered(true), 60); return () => clearTimeout(t); }, []);

  return (
    <div style={{
      position: "relative", minHeight: "calc(100vh - 53px)",
      background: "var(--surface)", overflow: "hidden",
    }}>
      {/* brand wash */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "radial-gradient(ellipse 1100px 700px at 12% -10%, rgba(14,116,144,.28), transparent 65%), radial-gradient(ellipse 800px 500px at 90% 110%, rgba(28,141,168,.16), transparent 60%)",
      }}/>
      <div className="textured" style={{ position: "absolute", inset: 0, opacity: .4, pointerEvents: "none" }}/>

      <div style={{
        position: "relative", maxWidth: 1280, margin: "0 auto",
        padding: "48px 32px 32px",
        display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 48, alignItems: "center",
      }}>
        <div style={{ opacity: entered ? 1 : 0, transform: entered ? "none" : "translateY(12px)", transition: "opacity .6s var(--ease-out-expo), transform .6s var(--ease-out-expo)" }}>
          <div className="overline" style={{ marginBottom: 14 }}>Process compliance</div>
          <h1 className="display" style={{
            margin: 0, fontSize: 60, lineHeight: 1.03, letterSpacing: "-.02em", maxWidth: 560,
          }}>
            Process compliance <span style={{ color: "var(--brand-300)" }}>you can prove.</span>
          </h1>
          <p className="muted" style={{ fontSize: 16, lineHeight: 1.55, marginTop: 20, maxWidth: 520 }}>
            Every domain event writes an append-only row whose hash chains to the one before it.
            Break a link and the verify endpoint says so.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
            <Button icon="arrow" onClick={onEnter}>Open dashboard</Button>
            <Button variant="secondary" icon="shield">Verify a chain</Button>
          </div>

          <div style={{ display: "flex", gap: 32, marginTop: 44, opacity: .85 }}>
            {[
              { k: "41,829", v: "audit rows" },
              { k: "0",       v: "hash breaks" },
              { k: "v14",     v: "workflow" },
              { k: "247",     v: "active" },
            ].map((x, i) => (
              <div key={i} style={{ opacity: entered ? 1 : 0, transform: entered ? "none" : "translateY(6px)", transition: `opacity .6s ${.3 + i * 0.08}s var(--ease-out-expo), transform .6s ${.3 + i * 0.08}s var(--ease-out-expo)` }}>
                <div className="display" style={{ fontSize: 26 }}>{x.k}</div>
                <div className="caps">{x.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ opacity: entered ? 1 : 0, transform: entered ? "none" : "scale(.96)", transition: "opacity .7s .2s var(--ease-out-expo), transform .7s .2s var(--ease-out-expo)" }}>
          <ChainHero3D/>
        </div>
      </div>
    </div>
  );
}

window.Landing = Landing;
