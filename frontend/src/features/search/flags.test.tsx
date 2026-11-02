import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { BasicSearchForm } from "./BasicSearchForm";
import { SearchBox } from "./SearchBox";

afterEach(() => vi.unstubAllEnvs());

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
