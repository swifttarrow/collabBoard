import Link from "next/link";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <main style={{ textAlign: "center", maxWidth: 560, padding: 24 }}>
        <div style={{ letterSpacing: "0.25em", fontSize: 12, opacity: 0.7 }}>
          COLLABBOARD
        </div>
        <h1 style={{ fontSize: 40, margin: "16px 0" }}>
          A real-time collaborative whiteboard.
        </h1>
        <p style={{ fontSize: 18, opacity: 0.8 }}>
          Start building the MVP: realtime sync, cursors, and AI commands.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link
            href="/canvas"
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              background: "#e2e8f0",
              color: "#0f172a",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Open Canvas
          </Link>
          <Link
            href="/login"
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              border: "1px solid rgba(226,232,240,0.3)",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Sign In
          </Link>
        </div>
      </main>
    </div>
  );
}
