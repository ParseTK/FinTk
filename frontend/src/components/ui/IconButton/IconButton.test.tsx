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

  it("has no accessibility violations", async () => {
    const { container } = render(
      <IconButton label="Close" variant="secondary">
        <svg aria-hidden="true" />
      </IconButton>,
    );
    await expectNoA11yViolations(container);
  });
});
