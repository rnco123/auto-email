import Link from "next/link";
import { LogoutButton } from "./logout-button";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/threads", label: "Threads" },
  { href: "/rules", label: "Rules" },
  { href: "/chat", label: "Chat-Dev" },
  { href: "/usage", label: "Usage" },
] as const;

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
        <nav className="app-header-nav" aria-label="Dashboard">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="app-header-actions">
          <LogoutButton />
        </div>
      </header>
      <main className="container container-wide">{children}</main>
    </>
  );
}
