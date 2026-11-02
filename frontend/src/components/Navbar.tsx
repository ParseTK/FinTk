import Image from "next/image";
import Link from "next/link";

export function Navbar() {
  return (
    <header className="container mx-auto p-6">
      <nav aria-label="Main" className="flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" aria-label="FinTk home">
            <Image src="/images/logo.png" alt="" width={102} height={28} priority />
          </Link>
          <Link href="/search" className="hover:text-brand-dark font-bold">
            Search
          </Link>
        </div>
        {/* Login / Signup are added with auth (plan step 6). */}
      </nav>
    </header>
  );
}
