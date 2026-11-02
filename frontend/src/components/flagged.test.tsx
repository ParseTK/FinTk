import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { expectNoA11yViolations } from "@/test/axe";
import { BasicSearchForm } from "./BasicSearchForm";
import { Feature } from "./Feature";
import { Hero } from "./Hero";
import { Navbar } from "./Navbar";
import { SearchBox } from "./SearchBox";

afterEach(() => vi.unstubAllEnvs());

describe("Feature", () => {
  it("renders children when the flag is on and the fallback when it is off", () => {
    vi.stubEnv("FEATURE_NEWS", "true");
    const { rerender } = render(
      <Feature flag="news" fallback={<p>fallback</p>}>
        <p>new thing</p>
      </Feature>,
    );
    expect(screen.getByText("new thing")).toBeInTheDocument();

    vi.stubEnv("FEATURE_NEWS", "false");
    rerender(
      <Feature flag="news" fallback={<p>fallback</p>}>
        <p>new thing</p>
      </Feature>,
    );
    expect(screen.getByText("fallback")).toBeInTheDocument();
    expect(screen.queryByText("new thing")).not.toBeInTheDocument();
  });
});

describe("hero_chart flag", () => {
  it("shows the chart by default", () => {
    render(<Hero />);
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("hides the chart but keeps the whole hero working when off", async () => {
    vi.stubEnv("FEATURE_HERO_CHART", "false");
    const { container } = render(<Hero />);
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe("rich_search flag", () => {
  it("uses the enhanced field by default (it has the / hint)", () => {
    const { container } = render(<SearchBox />);
    expect(container.querySelector("kbd")).toBeInTheDocument();
  });

  it("falls back to a plain, fully working form when off", async () => {
    vi.stubEnv("FEATURE_RICH_SEARCH", "false");
    const { container } = render(<SearchBox defaultValue="apple" />);
    expect(container.querySelector("kbd")).not.toBeInTheDocument();
    expect(screen.getByRole("search")).toHaveAttribute("action", "/search");
    const input = screen.getByRole("searchbox", { name: "Search companies" });
    expect(input).toHaveAttribute("name", "q");
    expect(input).toHaveValue("apple");
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("type", "submit");
    await expectNoA11yViolations(container);
  });

  it("the fallback is usable on its own", () => {
    render(<BasicSearchForm />);
    expect(screen.getByRole("searchbox")).toHaveAttribute("maxlength", "64");
  });
});

describe("palette flag", () => {
  it("shows the palette button by default", () => {
    render(<Navbar />);
    expect(screen.getByRole("button", { name: "Appearance" })).toBeInTheDocument();
  });

  it("hides only the palette when off; the rest of the nav still works", () => {
    vi.stubEnv("FEATURE_PALETTE", "false");
    render(<Navbar />);
    expect(screen.queryByRole("button", { name: "Appearance" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Virello home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search" })).toBeInTheDocument();
  });
});

describe("market_ticker flag", () => {
  it("shows the ticker by default and removes it when off", () => {
    const { unmount } = render(<HomePage />);
    expect(screen.getByRole("region", { name: /sample market snapshot/i })).toBeInTheDocument();
    unmount();

    vi.stubEnv("FEATURE_MARKET_TICKER", "false");
    render(<HomePage />);
    expect(
      screen.queryByRole("region", { name: /sample market snapshot/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
