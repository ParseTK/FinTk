import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { useFocusFirstInvalid } from "./useFocusFirstInvalid";

function Harness({ invalid }: { invalid: ReadonlyArray<"first" | "second"> }) {
  const form = useRef<HTMLFormElement>(null);
  const focusInvalid = useFocusFirstInvalid(form);
  const [errors, setErrors] = useState<ReadonlyArray<string>>([]);
  return (
    <form
      ref={form}
      onSubmit={(event) => {
        event.preventDefault();
        setErrors(invalid);
        if (invalid.length > 0) focusInvalid();
      }}
    >
      <input aria-label="first" aria-invalid={errors.includes("first") || undefined} />
      <input aria-label="second" aria-invalid={errors.includes("second") || undefined} />
      <button type="submit">Save</button>
    </form>
  );
}

describe("useFocusFirstInvalid", () => {
  it("moves focus to the first invalid field after a failed submit", async () => {
    render(<Harness invalid={["second", "first"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByLabelText("first")).toHaveFocus();
  });

  it("skips fields that are fine", async () => {
    render(<Harness invalid={["second"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByLabelText("second")).toHaveFocus();
  });

  it("leaves focus alone when nothing is invalid or nothing was requested", async () => {
    render(<Harness invalid={[]} />);
    const save = screen.getByRole("button", { name: "Save" });
    await userEvent.click(save);
    expect(save).toHaveFocus();
  });
});
