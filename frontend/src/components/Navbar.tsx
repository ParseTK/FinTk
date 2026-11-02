import Link from "next/link";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  return (
    <header className="container mx-auto p-6">
      <nav aria-label="Main" className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-10">
          <Link href="/" aria-label="Virello home">
            <Logo />
          </Link>
          <Link href="/search" className="hover:text-brand font-bold">
            Search
          </Link>
        </div>
        <ThemeToggle />
      </nav>
    </header>
  );
}
