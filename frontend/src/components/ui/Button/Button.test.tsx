import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { Button } from "./Button";

describe("Button", () => {
  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("allows type=submit", () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute("type", "submit");
  });

  it("calls onClick, and not when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);

    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is busy and unavailable while loading, and keeps its name", () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  it("is not given the disabled attribute while loading, so it can keep keyboard focus", () => {
    const { rerender } = render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    button.focus();
    expect(button).toHaveFocus();

    rerender(<Button loading>Save</Button>);
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();

    rerender(<Button>Save</Button>);
    expect(button).toHaveFocus();
    expect(button).not.toHaveAttribute("aria-disabled");
  });

  it("ignores presses while loading, for the keyboard as well as the mouse", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not submit its form while loading", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="name" />
        <Button type="submit" loading>
          Save
        </Button>
      </form>,
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.type(screen.getByLabelText("name"), "x{Enter}"); // implicit submission
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("still submits when it is not loading", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Save</Button>
      </form>,
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("applies variant and size styles", () => {
    render(
      <Button variant="danger" size="lg" fullWidth>
        Delete
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveClass("bg-loss", "px-6", "w-full");
  });

  it("only applies press and lift transforms when motion is allowed", () => {
    render(<Button>Go</Button>);
    const classes = screen.getByRole("button", { name: "Go" }).className;
    expect(classes).toContain("motion-safe:enabled:active:scale-");
    expect(classes).toContain("motion-safe:enabled:hover:-translate-y-px");
    expect(classes).not.toMatch(/(^|\s)(active|hover):(scale|-translate)/);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <div>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost" disabled>
          Ghost
        </Button>
        <Button loading>Loading</Button>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
