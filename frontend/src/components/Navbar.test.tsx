import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Navbar } from "./Navbar";

describe("Navbar", () => {
  it("links the Virello logo home with an accessible name", () => {
    render(<Navbar />);
    expect(screen.getByRole("link", { name: "Virello home" })).toHaveAttribute("href", "/");
  });

  it("links to search", () => {
    render(<Navbar />);
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search");
  });
});
