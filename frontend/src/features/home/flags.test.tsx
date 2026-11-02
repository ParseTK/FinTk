import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { Hero } from "./Hero";

afterEach(() => vi.unstubAllEnvs());

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
