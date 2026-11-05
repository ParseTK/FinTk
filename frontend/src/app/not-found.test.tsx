import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import NotFound, { metadata } from "./not-found";

describe("not found page", () => {
  it("has its own title, so assistive technology does not announce just the site name", () => {
    expect(metadata.title).toBe("Not found");
  });

  it("explains and offers a way back", async () => {
    const { container } = render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1, name: "Not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the home page" })).toHaveAttribute(
      "href",
      "/",
    );
    await expectNoA11yViolations(container);
  });
});
