import { Link } from "@tanstack/react-router";
import logo from "@/assets/kalee-logo.jpg.asset.json";

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo.url} alt="Kalee Nation" width={40} height={40} className="h-10 w-10 rounded-full ring-2 ring-primary/40" />
          <span className="font-display text-2xl tracking-widest">KALEE NATION</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-semibold uppercase tracking-wider">
          <Link to="/" hash="programs" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:block">Programs</Link>
          <Link to="/" hash="services" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:block">Services</Link>
          <Link to="/" hash="contact" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:block">Contact</Link>
          <Link to="/" hash="programs" className="rounded-md bg-bolt px-4 py-2 text-primary-foreground shadow-glow">Get Tickets</Link>
        </nav>
      </div>
    </header>
  );
}
