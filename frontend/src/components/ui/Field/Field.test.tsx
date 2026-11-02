import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { TextField } from "./Field";

describe("TextField", () => {
  it("connects the label to the input", async () => {
    const user = userEvent.setup();
    render(<TextField label="Email" />);
    const input = screen.getByLabelText("Email");
    await user.type(input, "a@b.co");
    expect(input).toHaveValue("a@b.co");
  });

  it("describes the input with its hint", () => {
    render(<TextField label="Ticker" hint="For example AAPL" />);
    expect(screen.getByLabelText("Ticker")).toHaveAccessibleDescription("For example AAPL");
  });

  it("is valid by default", () => {
    render(<TextField label="Name" />);
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid");
  });

  it("marks the input invalid and spells the error out in text", () => {
    render(
      <TextField label="Shares" hint="Whole or fractional" error="Must be greater than zero" />,
    );
    const input = screen.getByLabelText("Shares");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      /Whole or fractional.*Error: Must be greater than zero/,
    );
  });

  it("keeps the live region mounted so a new error is announced", () => {
    const { container, rerender } = render(<TextField label="Shares" />);
    const region = container.querySelector("[aria-live='polite']");
    expect(region).toBeInTheDocument();
    expect(region).toBeEmptyDOMElement();

    rerender(<TextField label="Shares" error="Required" />);
    expect(container.querySelector("[aria-live='polite']")).toBe(region);
    expect(region).toHaveTextContent("Error: Required");
  });

  it("uses a provided id", () => {
    render(<TextField label="Name" id="custom" />);
    expect(screen.getByLabelText("Name")).toHaveAttribute("id", "custom");
  });

  it("has no accessibility violations, with or without an error", async () => {
    const { container } = render(
      <form>
        <TextField label="Ticker" hint="For example AAPL" />
        <TextField label="Shares" error="Required" />
      </form>,
    );
    await expectNoA11yViolations(container);
  });
});
