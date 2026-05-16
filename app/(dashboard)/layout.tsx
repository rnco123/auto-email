import Link from "next/link";
import { LogoutButton } from "./logout-button";

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
        <div className="app-header-actions">
          <span className="muted" style={{ fontSize: "0.875rem" }}>
            Read-only logs
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
