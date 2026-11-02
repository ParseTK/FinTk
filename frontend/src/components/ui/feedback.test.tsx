import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { Alert } from "./Alert";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { Skeleton, SkeletonText } from "./Skeleton";

describe("EmptyState", () => {
  it("renders a heading, description and action", () => {
    render(
      <EmptyState
        title="Nothing saved yet"
        description="Search for a company to add it."
        action={<a href="/search">Search</a>}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Nothing saved yet" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Search for a company to add it.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search" })).toBeInTheDocument();
  });

  it("supports other heading levels", () => {
    render(<EmptyState title="Empty" headingLevel={1} />);
    expect(screen.getByRole("heading", { level: 1, name: "Empty" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <EmptyState title="Empty" description="Nothing here" icon={<svg />} />,
    );
    await expectNoA11yViolations(container);
  });
});

describe("ErrorState", () => {
  it("is an alert with a default title and no retry button unless asked", () => {
    render(<ErrorState />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onRetry from the retry button", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState description="We could not load data." onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText("We could not load data.")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ErrorState onRetry={() => {}} />);
    await expectNoA11yViolations(container);
  });
});

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

describe("Skeleton", () => {
  it("is hidden from assistive technology", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the requested number of text lines", () => {
    const { container } = render(<SkeletonText lines={4} />);
    expect(container.firstChild?.childNodes).toHaveLength(4);
  });
});

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
