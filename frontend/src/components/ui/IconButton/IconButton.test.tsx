import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("gets its accessible name from label", () => {
    render(
      <IconButton label="Close">
        <svg aria-hidden="true" />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("type", "button");
  });

  it("drops the size padding with an important class, so the icon fills the square", () => {
    // The padding that comes with the button size would otherwise win over a plain p-0 and shrink
    // the icon to a sliver (measured live: 8 px inside a 40 px button). jsdom has no stylesheet, so
    // this guards the class; the real width was checked in a browser.
    render(
      <IconButton label="Close" size="md">
        <svg aria-hidden="true" />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass("p-0!");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <IconButton label="Close" variant="secondary">
        <svg aria-hidden="true" />
      </IconButton>,
    );
    await expectNoA11yViolations(container);
  });
});
