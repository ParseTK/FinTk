import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { Alert } from "./Alert";

describe("Alert", () => {
  it.each([
    ["info", "status", "Information"],
    ["success", "status", "Success"],
    ["error", "alert", "Error"],
  ] as const)("%s uses role=%s and states its kind in text", (variant, role, label) => {
    render(
      <Alert variant={variant} title="Heads up">
        Details here
      </Alert>,
    );
    const alert = screen.getByRole(role);
    expect(alert).toHaveTextContent(`${label}: Heads up`);
    expect(alert).toHaveTextContent("Details here");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <div>
        <Alert title="Saved" variant="success" />
        <Alert title="Failed" variant="error">
          Try again
        </Alert>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
