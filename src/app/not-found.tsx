import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "Inter, sans-serif",
        background: "linear-gradient(135deg, #0f0c29, #302b63, #1a1040)",
        color: "#fff",
        textAlign: "center",
        padding: "20px",
        gap: "12px",
      }}
    >
      <div style={{ fontSize: "64px", marginBottom: "8px" }}>🚪</div>
      <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0 }}>404 — Page Not Found</h1>
      <p style={{ color: "rgba(255,255,255,0.5)", maxWidth: "360px", margin: 0 }}>
        This room doesn&apos;t seem to exist in the Foyer.
      </p>
      <Link
        href="/"
        style={{
          marginTop: "16px",
          padding: "12px 28px",
          borderRadius: "12px",
          background: "linear-gradient(135deg, #667eea, #764ba2)",
          color: "#fff",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: "15px",
          transition: "transform 0.2s",
        }}
      >
        Go Home
      </Link>
    </div>
  );
}
