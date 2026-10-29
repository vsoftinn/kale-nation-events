import { Link } from "@tanstack/react-router";
import logo from "@/assets/kalee-logo.jpg.asset.json";

const links = [
  { to: "/events", label: "Events" },
  { to: "/blog", label: "News" },
  { to: "/about", label: "About" },
] as const;

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo.url} alt="Kalee Nation" width={40} height={40} className="h-10 w-10 rounded-full ring-2 ring-primary/40" />
          <span className="font-display text-2xl tracking-widest">KALEE NATION</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-semibold uppercase tracking-wider">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="hidden text-muted-foreground transition-colors hover:text-foreground sm:block" activeProps={{ className: "!text-primary" }}>{l.label}</Link>
          ))}
          <Link to="/organizers" className="rounded-md bg-bolt px-4 py-2 text-primary-foreground shadow-glow">Sell tickets</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-10 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4">
        <p>© 2026 Kalee Nation · Eldoret & Nairobi, Kenya</p>
        <div className="flex gap-5">
          <Link to="/events" className="hover:text-foreground">Events</Link>
          <Link to="/blog" className="hover:text-foreground">News</Link>
          <Link to="/about" className="hover:text-foreground">About</Link>
          <Link to="/organizers" className="hover:text-foreground">For organizers</Link>
        </div>
      </div>
    </footer>
  );
}
