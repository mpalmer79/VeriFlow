import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 36, marginBottom: 12 }}>VeriFlow</h1>
      <p style={{ fontSize: 18, lineHeight: 1.5, color: "#b6c2cf" }}>
        Workflow intelligence for process compliance, operational risk, and explainable
        decisions. The first scenario is a healthcare intake and compliance workflow.
      </p>
      <nav style={{ marginTop: 32, display: "flex", gap: 16 }}>
        <Link href="/login" style={linkStyle}>
          Sign in
        </Link>
        <Link href="/dashboard" style={linkStyle}>
          Dashboard
        </Link>
      </nav>
    </main>
  );
}

const linkStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 6,
  background: "#1f6feb",
  color: "white",
  textDecoration: "none",
  fontWeight: 500,
};
