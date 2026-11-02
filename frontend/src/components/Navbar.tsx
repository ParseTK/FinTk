import Link from "next/link";
import { Logo } from "./Logo";

export function Navbar() {
  return (
    <header className="container mx-auto p-6">
      <nav aria-label="Main" className="flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" aria-label="Virello home">
            <Logo />
          </Link>
          <Link href="/search" className="hover:text-brand-dark font-bold">
            Search
          </Link>
        </div>
        {/* Login / Signup are added with auth. */}
      </nav>
    </header>
  );
}
