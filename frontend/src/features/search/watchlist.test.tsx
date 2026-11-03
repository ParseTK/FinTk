import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortfolioProvider } from "@/features/portfolio";
import { CompanyCard } from "./CompanyCard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const company = { ticker: "AAPL", name: "Apple Inc.", exchange: "Nasdaq", cik: "0000320193" };

function renderCard(props: Partial<React.ComponentProps<typeof CompanyCard>> = {}) {
  return render(
    <PortfolioProvider>
      <ul>
        <CompanyCard company={company} {...props} />
      </ul>
    </PortfolioProvider>,
  );
}

describe("CompanyCard watchlist toggle", () => {
  it("keeps the original in-browser toggle when sign-in is off (no watch state given)", () => {
    renderCard();
    expect(screen.getByRole("button", { name: /Add AAPL to portfolio/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Watch AAPL" })).not.toBeInTheDocument();
  });

  it("offers the real watchlist toggle to a signed-in person, already set when watched", () => {
    renderCard({ watch: { signedIn: true, csrfToken: "c", symbols: ["AAPL", "KO"] } });
    expect(screen.getByRole("button", { name: "Watch AAPL" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("button", { name: /to portfolio/ })).not.toBeInTheDocument();
  });

  it("shows an unwatched company as not pressed", () => {
    renderCard({ watch: { signedIn: true, csrfToken: "c", symbols: ["KO"] } });
    expect(screen.getByRole("button", { name: "Watch AAPL" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("invites a visitor to sign in, and brings them back to the same results", () => {
    renderCard({ watch: { signedIn: false }, signInNext: "/search?q=apple" });
    expect(screen.getByRole("link", { name: "Sign in to watch AAPL" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fsearch%3Fq%3Dapple",
    );
  });
});
