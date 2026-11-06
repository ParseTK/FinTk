import clsx from "clsx";
import Link from "next/link";
import { Suspense } from "react";
import { COLLAPSE_AFTER } from "./navigation";
import { headerItems } from "./sections";
import { Container } from "@/components/ui/Container";
import { Feature } from "@/components/ui/Feature";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { NavLink } from "./NavLink";
import { PalettePicker } from "@/features/appearance";
import { AccountMenu } from "@/features/auth";
import { CoinSearch } from "@/features/crypto";

/**
 * The header: the logo, one link per section (a section's own pages are in the sidebar), then the
 * account menu and the appearance picker.
 */
export function Navbar() {
  const items = headerItems();
  const collapse = items.length > COLLAPSE_AFTER;

  return (
    // The same wide container as the sidebar layout and the footer, so the logo, the sidebar and the
    // page edge line up at every window size.
    <header className="py-4">
      <Container size="wide">
        <nav
          aria-label="Main"
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
        >
          <Link href="/" aria-label="FinTk home">
            <Logo />
          </Link>
          <Feature flag="crypto_search">
            {/* Under the logo row on phones, between the logo and the links from the small breakpoint. */}
            <CoinSearch className="order-last w-full sm:order-none sm:mx-4 sm:w-auto sm:max-w-sm sm:flex-1" />
          </Feature>
          <div className="flex items-center gap-4 sm:gap-6">
            <div
              className={clsx("items-center gap-4 sm:gap-6", collapse ? "hidden sm:flex" : "flex")}
            >
              {items.map(({ href, label, exact, alsoActive }) => (
                <NavLink key={href} href={href} exact={exact} alsoActive={alsoActive}>
                  {label}
                </NavLink>
              ))}
            </div>
            {collapse && <MobileMenu items={items} />}
            <Feature flag="auth">
              {/* Streams in after the rest of the header, in a box the same size, so asking the API
                who is signed in never delays the page or makes the header jump. */}
              <Suspense fallback={<span aria-hidden="true" className="inline-block h-8 w-20" />}>
                <AccountMenu />
              </Suspense>
            </Feature>
            <Feature flag="palette">
              <PalettePicker />
            </Feature>
          </div>
        </nav>
      </Container>
    </header>
  );
}
