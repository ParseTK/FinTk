import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { Hero } from "./Hero";

describe("Hero", () => {
  it("has one h1 with the headline and a search landmark", () => {
    render(<Hero />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Financial data without the hype." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
  });

  it("offers the sample chart as an operable slider", () => {
    render(<Hero />);
    expect(screen.getByRole("slider", { name: /sample price chart/i })).toBeInTheDocument();
  });

  it("hides the purely decorative background from assistive technology", () => {
    const { container } = render(<Hero />);
    const decorative = container.querySelector("section > div[aria-hidden='true']");
    expect(decorative).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Hero />);
    await expectNoA11yViolations(container);
  });
});
