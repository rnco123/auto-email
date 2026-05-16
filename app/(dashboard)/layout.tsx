import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="app-header">
        <h1>
          <Link href="/">Patient Email Automation</Link>
        </h1>
        <span className="muted" style={{ fontSize: "0.875rem" }}>
          Read-only logs
        </span>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
