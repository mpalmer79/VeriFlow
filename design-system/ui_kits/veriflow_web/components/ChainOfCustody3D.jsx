/* global React */
// Upgraded 3D chain: auto-orbit, mouse parallax, larger scale, traveling
// verify-dot, depth fog via layered box-shadows. Pure CSS 3D.
const { useRef: uR, useEffect: uE, useState: uS } = React;

function Link3D({ index, total, rotateY, big }) {
  const pitch = big ? 72 : 48;
  const z = (index - (total - 1) / 2) * pitch;
  const delay = index * 0.22;
  const size = big ? { w: 132, h: 70 } : { w: 96, h: 54 };
  const fogOpacity = 1 - Math.abs(index - (total - 1) / 2) / total * 0.5;
  return (
    <div style={{
      position: "absolute", left: "50%", top: "50%",
      transform: `translate(-50%, -50%) rotateY(${rotateY}deg) translateZ(${z}px) rotateY(${-rotateY}deg)`,
      transformStyle: "preserve-3d", opacity: fogOpacity,
    }}>
      <div style={{
        width: size.w, height: size.h, borderRadius: 999,
        border: "2px solid var(--brand-400)",
        background: "radial-gradient(ellipse at center, rgba(14,116,144,.22), transparent 70%)",
        boxShadow: "0 0 30px rgba(61,171,196,.45), inset 0 0 14px rgba(14,116,144,.3)",
        animation: `vf-chain-pulse 2.6s ease-in-out ${delay}s infinite`,
        position: "relative", transformStyle: "preserve-3d",
      }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: 999,
          border: "1px solid rgba(61,171,196,.4)", transform: "rotateX(90deg)",
        }}/>
        <div style={{
          position: "absolute", inset: -2, borderRadius: 999,
          border: "1px solid rgba(61,171,196,.15)", transform: "rotateX(45deg) rotateY(30deg)",
        }}/>
      </div>
      <div className="mono" style={{
        position: "absolute", top: "100%", left: "50%", transform: "translate(-50%, 8px)",
        fontSize: big ? 10 : 9, color: "var(--text-muted)", whiteSpace: "nowrap",
        letterSpacing: ".04em",
      }}>{["a1b6","9c3f","64a2","1d8e","3a6f","40c8","88d1","c9f3","2e11"][index % 9]}…</div>
    </div>
  );
}

function Chain3D({ big = false, height = 260, links = 7 }) {
  const [yaw, setYaw] = uS(-22);
  const [pitch, setPitch] = uS(14);
  const dragging = uR(false);
  const last = uR({ x: 0, y: 0 });
  const hoverRef = uR({ x: 0, y: 0 });
  const wrap = uR(null);

  // auto-orbit + easing back to target after user input
  uE(() => {
    let raf, t0 = performance.now();
    const tick = (t) => {
      if (!dragging.current) {
        const dt = (t - t0) / 1000;
        const base = big ? -22 + Math.sin(dt * 0.4) * 28 : -22 + Math.sin(dt * 0.6) * 10;
        setYaw(y => y + (base - y) * 0.04);
        const parallax = hoverRef.current.y * 10;
        setPitch(p => p + ((14 + parallax) - p) * 0.08);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [big]);

  const onMove = (e) => {
    if (dragging.current) {
      setYaw(y => y + (e.clientX - last.current.x) * 0.6);
      setPitch(p => Math.max(-10, Math.min(50, p - (e.clientY - last.current.y) * 0.3)));
      last.current = { x: e.clientX, y: e.clientY };
      return;
    }
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect) return;
    hoverRef.current = {
      x: (e.clientX - rect.left) / rect.width - 0.5,
      y: (e.clientY - rect.top) / rect.height - 0.5,
    };
  };
  const onDown = (e) => { dragging.current = true; last.current = { x: e.clientX, y: e.clientY }; };
  const onUp = () => { dragging.current = false; };

  return (
    <div ref={wrap}
      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      style={{
        position: "relative", height, perspective: big ? 1400 : 900,
        cursor: dragging.current ? "grabbing" : "grab",
        background: `
          radial-gradient(ellipse at ${50 + (hoverRef.current.x * 20)}% 0%, rgba(14,116,144,.28), transparent 60%),
          radial-gradient(ellipse at 80% 100%, rgba(61,171,196,.14), transparent 50%),
          var(--surface-muted)`,
        border: "1px solid var(--surface-border)", borderRadius: 8, overflow: "hidden",
      }}
    >
      {/* deep-space stars */}
      {big && Array.from({ length: 40 }).map((_, i) => {
        const x = (i * 137.5) % 100, y = (i * 76.9) % 100;
        return <div key={i} style={{
          position: "absolute", left: `${x}%`, top: `${y}%`,
          width: 2, height: 2, borderRadius: 999, background: "rgba(61,171,196,.5)",
          animation: `vf-chain-pulse ${2 + (i % 5)}s ease-in-out ${i * 0.1}s infinite`,
        }}/>;
      })}

      {/* grid floor */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: big ? 200 : 120,
        transform: "rotateX(68deg) translateZ(-20px)", transformOrigin: "bottom",
        backgroundImage: `
          linear-gradient(rgba(61,171,196,.22) 1px, transparent 1px),
          linear-gradient(90deg, rgba(61,171,196,.22) 1px, transparent 1px)`,
        backgroundSize: "48px 48px",
        maskImage: "linear-gradient(180deg, transparent, black 40%, black)",
        WebkitMaskImage: "linear-gradient(180deg, transparent, black 40%, black)",
      }}/>

      {/* chain stage */}
      <div style={{
        position: "absolute", inset: 0,
        transformStyle: "preserve-3d",
        transform: `rotateX(${pitch}deg)`,
      }}>
        {Array.from({ length: links }).map((_, i) =>
          <Link3D key={i} index={i} total={links} rotateY={yaw} big={big}/>
        )}
      </div>

      {/* overlay */}
      <div style={{
        position: "absolute", top: 14, left: 16, display: "flex", gap: 10, alignItems: "center",
        fontSize: 11, color: "var(--text-muted)",
      }}>
        <span className="caps" style={{ color: "var(--brand-400)", fontWeight: 600, letterSpacing: ".18em" }}>Evidence chain</span>
        <span className="mono">· drag to rotate</span>
      </div>
      <div className="mono" style={{
        position: "absolute", bottom: 10, right: 12, fontSize: 10, color: "var(--text-subtle)",
      }}>yaw {yaw.toFixed(0)}° · pitch {pitch.toFixed(0)}°</div>
    </div>
  );
}

function ChainOfCustody3D() { return <Chain3D height={260} links={7} big={false}/>; }
function ChainHero3D()     { return <Chain3D height={440} links={9} big={true}/>; }

window.ChainOfCustody3D = ChainOfCustody3D;
window.ChainHero3D = ChainHero3D;
