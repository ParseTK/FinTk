import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const sendJson = vi.fn();
vi.mock("@/lib/apiRequest", () => ({ sendJson: (...args: unknown[]) => sendJson(...args) }));

const { AddPurchasePanel, MAX_ROWS } = await import("./AddPurchasePanel");

const ok = () => ({ ok: true, data: {}, created: true });
const fail = (
  kind: string,
  message: string,
  rows: Record<number, Record<string, string>> = {},
) => ({ ok: false, kind, message, fields: {}, rows });

let uuid = 0;
beforeEach(() => {
  refresh.mockReset();
  sendJson.mockReset();
  uuid = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(
    () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}`,
  );
});

const toggle = () => screen.getByRole("button", { name: /^(Add record|Close)$/ });
const renderPanel = () =>
  render(<AddPurchasePanel csrfToken="csrf-1" heading={<h1>Portfolio</h1>} />);

async function open() {
  await userEvent.click(toggle());
}

/** Fill the nth row (0-based) of the open form. */
async function fillRow(
  index: number,
  values: { symbol?: string; shares?: string; cost?: string; date?: string },
) {
  const group = screen.getAllByRole("group")[index]!;
  const set = async (label: RegExp | string, value?: string) => {
    if (value === undefined) return;
    const field = within(group).getByLabelText(label);
    await userEvent.clear(field);
    await userEvent.type(field, value);
  };
  await set("Ticker symbol", values.symbol);
  await set("Shares", values.shares);
  await set("Price per share (USD)", values.cost);
  await set(/^Purchase date/, values.date);
}

describe("opening and closing", () => {
  it("starts closed: the button says so and the form cannot be reached", () => {
    const { container } = renderPanel();
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    const panel = document.getElementById(toggle().getAttribute("aria-controls")!)!;
    expect(panel).toHaveAttribute("inert");
    expect(container.querySelector("form")).not.toBeNull(); // present, but inert while closed
    expect(screen.getByRole("heading", { name: "Portfolio" })).toBeInTheDocument();
  });

  it("is titled for what it does: adding one or several records", async () => {
    renderPanel();
    await open();
    expect(screen.getByRole("heading", { name: "New records" })).toBeInTheDocument();
    expect(screen.getByText(/saved together, or not at all/)).toBeInTheDocument();
    expect(screen.queryByText(/^Add a purchase$/)).not.toBeInTheDocument();
  });

  it("opens on click, moves focus to the first field and offers to close", async () => {
    renderPanel();
    await open();
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(toggle()).toHaveTextContent("Close");
    const panel = document.getElementById(toggle().getAttribute("aria-controls")!)!;
    expect(panel).not.toHaveAttribute("inert");
    expect(screen.getByLabelText("Ticker symbol")).toHaveFocus();
  });

  it("closes with the button, Cancel or Escape and returns focus to the button", async () => {
    renderPanel();
    for (const how of ["button", "cancel", "escape"] as const) {
      await open();
      if (how === "button") await userEvent.click(toggle());
      if (how === "cancel") await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      if (how === "escape") await userEvent.keyboard("{Escape}");
      expect(toggle()).toHaveAttribute("aria-expanded", "false");
      expect(toggle()).toHaveFocus();
    }
  });

  it("keeps what was typed when it is closed and reopened", async () => {
    renderPanel();
    await open();
    await fillRow(0, { symbol: "AAPL", shares: "3" });
    await userEvent.click(toggle());
    await open();
    expect(screen.getByLabelText("Ticker symbol")).toHaveValue("AAPL");
    expect(screen.getByLabelText("Shares")).toHaveValue("3");
  });

  it("has no accessibility violations open or closed", async () => {
    const { container } = renderPanel();
    await expectNoA11yViolations(container);
    await open();
    await expectNoA11yViolations(container);
  });
});

describe("rows", () => {
  it("adds and removes rows, but never removes the last one", async () => {
    renderPanel();
    await open();
    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add another record" }));
    expect(screen.getAllByRole("group")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Remove record 2" }));
    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();
  });

  it("stops offering rows at the limit and says why", async () => {
    renderPanel();
    await open();
    const add = screen.getByRole("button", { name: "Add another record" });
    for (let i = 1; i < MAX_ROWS; i++) await userEvent.click(add);
    expect(screen.getAllByRole("group")).toHaveLength(MAX_ROWS);
    expect(add).toBeDisabled();
    expect(screen.getByText(`Up to ${MAX_ROWS} at once.`)).toBeInTheDocument();
  });

  it("names each row for assistive technology", async () => {
    renderPanel();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Add another record" }));
    expect(screen.getByRole("group", { name: "Record 2" })).toBeInTheDocument();
  });

  it("counts the rows it will save in the button", async () => {
    renderPanel();
    await open();
    expect(screen.getByRole("button", { name: "Save record" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add another record" }));
    await fillRow(0, { symbol: "AAPL" });
    await fillRow(1, { symbol: "MSFT" });
    expect(screen.getByRole("button", { name: "Save 2 records" })).toBeInTheDocument();
  });
});

describe("saving", () => {
  it("sends the whole batch once with the token and a key, skipping blank rows", async () => {
    sendJson.mockResolvedValue(ok());
    renderPanel();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Add another record" }));
    await userEvent.click(screen.getByRole("button", { name: "Add another record" }));
    await fillRow(0, { symbol: " aapl ", shares: " 10.5 ", cost: "187.12" });
    await fillRow(2, { symbol: "msft", shares: "2", cost: "300", date: "2024-05-31" }); // row 1 blank

    await userEvent.click(screen.getByRole("button", { name: "Save 2 records" }));

    expect(sendJson).toHaveBeenCalledTimes(1);
    expect(sendJson).toHaveBeenCalledWith("POST", "/api/v1/portfolio/lots/batch", "csrf-1", {
      body: {
        lots: [
          { symbol: "AAPL", shares: "10.5", unit_cost: "187.12" },
          { symbol: "MSFT", shares: "2", unit_cost: "300", acquired_on: "2024-05-31" },
        ],
      },
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("on success says what was added, resets, closes, returns focus and refreshes", async () => {
    sendJson.mockResolvedValue(ok());
    renderPanel();
    await open();
    await fillRow(0, { symbol: "AAPL", shares: "1", cost: "2" });
    await userEvent.click(screen.getByRole("button", { name: "Save record" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Added 1 record."));
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle()).toHaveFocus();
    expect(refresh).toHaveBeenCalledTimes(1);
    await open();
    expect(screen.getByLabelText("Ticker symbol")).toHaveValue(""); // ready for the next batch
    expect(screen.getAllByRole("group")).toHaveLength(1);
  });

  it("says how many were added for a batch", async () => {
    sendJson.mockResolvedValue(ok());
    renderPanel();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Add another record" }));
    await fillRow(0, { symbol: "AAPL", shares: "1", cost: "2" });
    await fillRow(1, { symbol: "KO", shares: "1", cost: "2" });
    await userEvent.click(screen.getByRole("button", { name: "Save 2 records" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Added 2 records."));
  });

  it("asks for what is missing without calling the server", async () => {
    renderPanel();
    await open();
    await fillRow(0, { symbol: "AAPL" });
    await userEvent.click(screen.getByRole("button", { name: "Save record" }));

    expect(sendJson).not.toHaveBeenCalled();
    expect(screen.getByText(/Enter a number of shares/)).toBeInTheDocument();
    expect(screen.getByText(/Enter the price you paid/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Nothing was saved.");
    expect(screen.getByLabelText("Shares")).toBeInvalid();
    // Keyboard focus goes to the first field that needs fixing, not left on the Save button.
    expect(screen.getByLabelText("Shares")).toHaveFocus();
  });

  it("will not save an empty form", async () => {
    renderPanel();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Save record" }));
    expect(sendJson).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one record.");
  });

  it("marks a server problem on the right row, keeps everything typed and stays open", async () => {
    sendJson.mockResolvedValue(
      fail("invalid", "Check the highlighted fields.", {
        1: { symbol: "We could not find a company with that ticker." }, // the 2nd FILLED row
      }),
    );
    renderPanel();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Add another record" }));
    await userEvent.click(screen.getByRole("button", { name: "Add another record" }));
    await fillRow(0, { symbol: "AAPL", shares: "1", cost: "2" });
    await fillRow(2, { symbol: "NOPEX", shares: "3", cost: "4" }); // row 1 is blank and skipped
    await userEvent.click(screen.getByRole("button", { name: "Save 2 records" }));

    const third = screen.getByRole("group", { name: "Record 3" });
    expect(within(third).getByText(/could not find a company/)).toBeInTheDocument();
    expect(within(third).getByLabelText("Ticker symbol")).toBeInvalid();
    // After a server rejection focus lands on the field the server complained about.
    expect(within(third).getByLabelText("Ticker symbol")).toHaveFocus();
    expect(
      within(screen.getByRole("group", { name: "Record 1" })).queryByText(/could not find/),
    ).not.toBeInTheDocument();
    expect(within(third).getByLabelText("Shares")).toHaveValue("3");
    expect(screen.getByRole("alert")).toHaveTextContent("Nothing was saved.");
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    ["limit", "These 3 purchases would go over the limit of 500 (you have 499)."],
    ["failed", "Something went wrong. Please try again."],
  ])("shows a %s problem as a message and keeps the form", async (kind, message) => {
    sendJson.mockResolvedValue(fail(kind, message));
    renderPanel();
    await open();
    await fillRow(0, { symbol: "AAPL", shares: "1", cost: "2" });
    await userEvent.click(screen.getByRole("button", { name: "Save record" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText("Ticker symbol")).toHaveValue("AAPL");
  });

  it("reuses the key for an identical retry and makes a new one when anything changed", async () => {
    sendJson.mockResolvedValue(fail("failed", "Something went wrong. Please try again."));
    renderPanel();
    await open();
    await fillRow(0, { symbol: "AAPL", shares: "1", cost: "2" });
    const save = () => userEvent.click(screen.getByRole("button", { name: "Save record" }));

    await save();
    await save();
    await fillRow(0, { shares: "5" });
    await save();

    const keys = sendJson.mock.calls.map((call) => call[3].idempotencyKey);
    expect(keys[0]).toBe(keys[1]); // same content: same key, so the server cannot add it twice
    expect(keys[2]).not.toBe(keys[0]); // changed content: a different request
  });

  it("does not send twice while a save is in flight", async () => {
    let finish: (value: unknown) => void = () => {};
    sendJson.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderPanel();
    await open();
    await fillRow(0, { symbol: "AAPL", shares: "1", cost: "2" });
    const save = screen.getByRole("button", { name: "Save record" });
    await userEvent.click(save);
    await userEvent.click(save);
    expect(sendJson).toHaveBeenCalledTimes(1);
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveFocus(); // busy, but focus is not thrown away
    finish(ok());
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
