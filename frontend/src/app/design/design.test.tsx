import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import DesignPage, { metadata } from "./page";

afterEach(() => vi.unstubAllEnvs());

describe("design gallery", () => {
  it("is a 404 unless the design flag is on", () => {
    expect(() => render(<DesignPage />)).toThrow();
  });

  it("is never indexed", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  describe("with the flag on", () => {
    it("shows every section under one h1", () => {
      vi.stubEnv("FEATURE_DESIGN", "true");
      render(<DesignPage />);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      for (const name of [
        "Color tokens",
        "Typography",
        "Buttons",
        "Form fields",
        "Alerts and states",
        "Data display",
        "Loading placeholders",
        "Brand and motion",
      ]) {
        expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
      }
    });

    it("has no accessibility violations", async () => {
      vi.stubEnv("FEATURE_DESIGN", "true");
      const { container } = render(<DesignPage />);
      await expectNoA11yViolations(container);
    });
  });
});
