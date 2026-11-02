import Link from "next/link";
import { Logo } from "./Logo";
import { PalettePicker } from "./PalettePicker";

export function Navbar() {
  return (
    <header className="container mx-auto p-6">
      <nav aria-label="Main" className="flex items-center justify-between gap-4">
        <Link href="/" aria-label="Virello home">
          <Logo />
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/search" className="hover:text-brand font-semibold">
            Search
          </Link>
          <PalettePicker />
        </div>
      </nav>
    </header>
  );
}
