import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SearchForm } from "./SearchForm";

describe("SearchForm", () => {
  it("is a labelled search landmark that submits q via GET to /search", () => {
    render(<SearchForm />);
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("action", "/search");
    const input = screen.getByRole("searchbox", { name: "Search companies" });
    expect(input).toHaveAttribute("name", "q");
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("type", "submit");
  });

  it("pre-fills the current query", () => {
    render(<SearchForm defaultValue="apple" />);
    expect(screen.getByRole("searchbox")).toHaveValue("apple");
  });

  it("focuses the field when / is pressed outside an input", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">other</button>
        <SearchForm />
      </>,
    );
    screen.getByRole("button", { name: "other" }).focus();

    await user.keyboard("/");

    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  it("does not hijack / while typing in the field", async () => {
    const user = userEvent.setup();
    render(<SearchForm />);
    const input = screen.getByRole("searchbox");
    await user.click(input);

    await user.keyboard("a/b");

    expect(input).toHaveValue("a/b");
  });
});
