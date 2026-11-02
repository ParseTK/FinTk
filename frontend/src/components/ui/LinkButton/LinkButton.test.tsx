import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LinkButton } from "./LinkButton";

describe("LinkButton", () => {
  it("is a link that looks like a button", () => {
    render(<LinkButton href="/search">Go to search</LinkButton>);
    const link = screen.getByRole("link", { name: "Go to search" });
    expect(link).toHaveAttribute("href", "/search");
    expect(link).toHaveClass("bg-brand");
  });
});
