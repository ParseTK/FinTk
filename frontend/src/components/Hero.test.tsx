import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Hero } from "./Hero";

describe("Hero", () => {
  it("has one h1 with the headline and a search landmark", () => {
    render(<Hero />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Financial data without the hype." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
  });

  it("describes the hero image", () => {
    render(<Hero />);
    expect(screen.getByRole("img", { name: /chart/i })).toBeInTheDocument();
  });
});
