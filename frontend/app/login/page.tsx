export default function LoginPage() {
  return (
    <main style={{ maxWidth: 420, margin: "120px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Sign in to VeriFlow</h1>
      <p style={{ color: "#b6c2cf", marginBottom: 32 }}>
        Authentication UI is scaffolded for Phase 1. Real form wiring will be added in a
        later phase.
      </p>

      <form style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span>Email</span>
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            disabled
            style={inputStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span>Password</span>
          <input
            type="password"
            name="password"
            placeholder="••••••••"
            disabled
            style={inputStyle}
          />
        </label>

        <button type="button" disabled style={buttonStyle}>
          Sign in (placeholder)
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid #30363d",
  background: "#0d1117",
  color: "#e6edf3",
  fontSize: 14,
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 6,
  border: "none",
  background: "#1f6feb",
  color: "white",
  fontWeight: 600,
  cursor: "not-allowed",
  opacity: 0.7,
};
