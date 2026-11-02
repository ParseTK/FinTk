import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("renders the chosen element", () => {
    render(
      <ul>
        <Card as="li">Row</Card>
      </ul>,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("Row");
  });

  it("defaults to a div and merges classes", () => {
    const { container } = render(<Card className="p-2">Body</Card>);
    expect(container.firstElementChild?.tagName).toBe("DIV");
    expect(container.firstElementChild).toHaveClass("rounded-xl", "p-2");
  });
});
