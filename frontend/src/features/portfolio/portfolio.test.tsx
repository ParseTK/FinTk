import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const sendJson = vi.fn();
vi.mock("@/lib/apiRequest", () => ({ sendJson: (...args: unknown[]) => sendJson(...args) }));

const GET = vi.fn();
vi.mock("@/lib/api/client", () => ({ privateApi: { GET: (...args: unknown[]) => GET(...args) } }));
vi.mock("@/lib/api/authHeaders", () => ({
  authHeaders: async () => ({ cookie: "virello_session=t" }),
}));

const { AddPurchaseForm, getLots, getPortfolio, HoldingsTable, PurchasesSection } =
  await import("./index");
const { PurchaseItem } = await import("./PurchaseItem");

const ok = (data: unknown = {}, created = true) => ({ ok: true, data, created });
const fail = (kind: string, message: string, fields: Record<string, string> = {}) => ({
  ok: false,
  kind,
  message,
  fields,
});

const lot = (overrides: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  symbol: "AAPL",
  shares: "10.000000",
  unit_cost: "100.000000",
  cost: "1000.00",
  acquired_on: "2024-03-15",
  created_at: "2026-05-01T10:00:00Z",
  updated_at: "2026-05-01T10:00:00Z",
  ...overrides,
});

const holding = (symbol: string, name: string | null, extra: Record<string, unknown> = {}) => ({
  symbol,
  name,
  shares: "15.000000",
  average_cost: "110.000000",
  cost_basis: "1650.00",
  lots: 2,
  ...extra,
});

let uuidCounter = 0;
beforeEach(() => {
  refresh.mockReset();
  sendJson.mockReset();
  GET.mockReset();
  uuidCounter = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(
    () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, "0")}`,
  );
});

async function fill(values: { symbol?: string; shares?: string; cost?: string; date?: string }) {
  if (values.symbol !== undefined) {
    const field = screen.getByLabelText("Ticker symbol");
    await userEvent.clear(field);
    await userEvent.type(field, values.symbol);
  }
  if (values.shares !== undefined) {
    const field = screen.getByLabelText(/^Shares/);
    await userEvent.clear(field);
    await userEvent.type(field, values.shares);
  }
  if (values.cost !== undefined) {
    const field = screen.getByLabelText("Price per share (USD)");
    await userEvent.clear(field);
    await userEvent.type(field, values.cost);
  }
  if (values.date !== undefined) {
    const field = screen.getByLabelText(/^Purchase date/);
    await userEvent.clear(field);
    await userEvent.type(field, values.date);
  }
}

const submit = () => userEvent.click(screen.getByRole("button", { name: "Add purchase" }));

describe("AddPurchaseForm", () => {
  it("labels every field, asks for what it needs, and has no violations", async () => {
    const { container } = render(<AddPurchaseForm csrfToken="c" />);
    expect(screen.getByRole("form", { name: "Add a purchase" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ticker symbol")).toBeRequired();
    expect(screen.getByLabelText(/^Shares/)).toBeRequired();
    expect(screen.getByLabelText("Price per share (USD)")).toBeRequired();
    expect(screen.getByLabelText(/^Purchase date/)).not.toBeRequired();
    await expectNoA11yViolations(container);
  });

  it("sends tidy values, with the CSRF token and an idempotency key", async () => {
    sendJson.mockResolvedValue(ok());
    render(<AddPurchaseForm csrfToken="csrf-9" />);

    await fill({ symbol: " aapl ", shares: " 10.5 ", cost: "187.12" });
    await submit();

    expect(sendJson).toHaveBeenCalledWith("POST", "/api/v1/portfolio/lots", "csrf-9", {
      body: { symbol: "AAPL", shares: "10.5", unit_cost: "187.12" },
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("includes the purchase date only when one is chosen", async () => {
    sendJson.mockResolvedValue(ok());
    render(<AddPurchaseForm csrfToken="c" />);

    await fill({ symbol: "MSFT", shares: "1", cost: "2", date: "2024-05-31" });
    await submit();

    expect(sendJson.mock.calls[0]![3].body).toEqual({
      symbol: "MSFT",
      shares: "1",
      unit_cost: "2",
      acquired_on: "2024-05-31",
    });
  });

  it("cannot pick a date in the future", () => {
    render(<AddPurchaseForm csrfToken="c" />);
    const max = screen.getByLabelText(/^Purchase date/).getAttribute("max");
    expect(max).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(max! <= new Date().toLocaleDateString("en-CA")).toBe(true);
  });

  it("confirms, clears the form and refreshes the page after a success", async () => {
    sendJson.mockResolvedValue(ok());
    render(<AddPurchaseForm csrfToken="c" />);

    await fill({ symbol: "AAPL", shares: "10", cost: "100" });
    await submit();

    expect(await screen.findByRole("status")).toHaveTextContent("Added 10 shares of AAPL.");
    expect(screen.getByLabelText("Ticker symbol")).toHaveValue("");
    expect(screen.getByLabelText(/^Shares/)).toHaveValue("");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("reuses the key when the same content is sent again, so a retry cannot double-count", async () => {
    sendJson.mockResolvedValueOnce(fail("failed", "Something went wrong. Please try again."));
    sendJson.mockResolvedValueOnce(ok());
    render(<AddPurchaseForm csrfToken="c" />);

    await fill({ symbol: "AAPL", shares: "10", cost: "100" });
    await submit();
    await screen.findByText("Something went wrong. Please try again.");
    await submit(); // same content, second attempt

    expect(sendJson).toHaveBeenCalledTimes(2);
    expect(sendJson.mock.calls[0]![3].idempotencyKey).toBe(
      sendJson.mock.calls[1]![3].idempotencyKey,
    );
  });

  it("uses a new key as soon as anything changes (the server rejects a reused key with new content)", async () => {
    sendJson.mockResolvedValueOnce(fail("failed", "Something went wrong. Please try again."));
    sendJson.mockResolvedValueOnce(ok());
    render(<AddPurchaseForm csrfToken="c" />);

    await fill({ symbol: "AAPL", shares: "10", cost: "100" });
    await submit();
    await screen.findByText("Something went wrong. Please try again.");
    await fill({ shares: "20" });
    await submit();

    expect(sendJson.mock.calls[0]![3].idempotencyKey).not.toBe(
      sendJson.mock.calls[1]![3].idempotencyKey,
    );
  });

  it("starts a fresh key for the next purchase after one succeeds", async () => {
    sendJson.mockResolvedValue(ok());
    render(<AddPurchaseForm csrfToken="c" />);

    await fill({ symbol: "AAPL", shares: "10", cost: "100" });
    await submit();
    await screen.findByRole("status");
    await fill({ symbol: "AAPL", shares: "10", cost: "100" }); // identical, but a new purchase
    await submit();

    expect(sendJson.mock.calls[0]![3].idempotencyKey).not.toBe(
      sendJson.mock.calls[1]![3].idempotencyKey,
    );
  });

  it("ignores a second click while the first request is still running", async () => {
    let finish: (value: unknown) => void = () => {};
    sendJson.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<AddPurchaseForm csrfToken="c" />);

    await fill({ symbol: "AAPL", shares: "10", cost: "100" });
    await submit();
    await submit();
    await submit();

    expect(sendJson).toHaveBeenCalledOnce();
    finish(ok());
  });

  it("shows each field's problem next to the field and keeps what was typed", async () => {
    sendJson.mockResolvedValue(
      fail("invalid", "Check the highlighted fields.", {
        shares: "Enter a number of shares above zero, with at most 6 decimals.",
        unit_cost: "Enter a price above zero, with at most 6 decimals.",
      }),
    );
    const { container } = render(<AddPurchaseForm csrfToken="c" />);

    await fill({ symbol: "AAPL", shares: "-1", cost: "abc" });
    await submit();

    const shares = screen.getByLabelText(/^Shares/);
    expect(shares).toBeInvalid();
    expect(shares).toHaveAccessibleDescription(/shares above zero/);
    expect(screen.getByLabelText("Price per share (USD)")).toBeInvalid();
    expect(shares).toHaveValue("-1"); // not wiped
    expect(refresh).not.toHaveBeenCalled();
    await expectNoA11yViolations(container);
  });

  it("explains an unknown company in plain words", async () => {
    sendJson.mockResolvedValue(fail("not-found", "We could not find that."));
    render(<AddPurchaseForm csrfToken="c" />);

    await fill({ symbol: "ZZZZ", shares: "1", cost: "1" });
    await submit();

    expect(
      await screen.findByText("We could not find a company with that ticker."),
    ).toBeInTheDocument();
  });

  it.each([
    ["limit", "You have reached the limit of 500 purchases."],
    ["rate-limited", "You are making changes too quickly. Wait a moment and try again."],
    ["stale", "This page is out of date. Reload it and try again."],
  ])("shows the message for %s", async (kind, message) => {
    sendJson.mockResolvedValue(fail(kind, message));
    render(<AddPurchaseForm csrfToken="c" />);
    await fill({ symbol: "AAPL", shares: "1", cost: "1" });
    await submit();
    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});

describe("PurchaseItem", () => {
  it("shows what was bought, what it cost, and when", async () => {
    const { container } = render(
      <ul>
        <PurchaseItem lot={lot()} csrfToken="c" />
      </ul>,
    );
    expect(screen.getByText("10 shares")).toBeInTheDocument();
    expect(screen.getByText(/\$100\.00/)).toBeInTheDocument();
    expect(screen.getByText(/= \$1,000\.00/)).toBeInTheDocument();
    expect(screen.getByText("Mar 15, 2024")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("says when there is no date, and labels its buttons with what they act on", () => {
    render(
      <ul>
        <PurchaseItem lot={lot({ acquired_on: null })} csrfToken="c" />
      </ul>,
    );
    expect(screen.getByText("No date")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit purchase of 10 AAPL" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete purchase of 10 AAPL" })).toBeInTheDocument();
  });

  it("edits with the values prefilled the way a person would type them", async () => {
    sendJson.mockResolvedValue(ok({}, false));
    render(
      <ul>
        <PurchaseItem lot={lot({ shares: "12.500000", unit_cost: "187.120000" })} csrfToken="c9" />
      </ul>,
    );

    await userEvent.click(screen.getByRole("button", { name: /Edit purchase/ }));
    expect(screen.getByLabelText("Shares")).toHaveValue("12.5");
    expect(screen.getByLabelText("Price per share (USD)")).toHaveValue("187.12");

    await userEvent.clear(screen.getByLabelText("Shares"));
    await userEvent.type(screen.getByLabelText("Shares"), "20");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(sendJson).toHaveBeenCalledWith(
      "PUT",
      "/api/v1/portfolio/lots/11111111-1111-4111-8111-111111111111",
      "c9",
      { body: { shares: "20", unit_cost: "187.12", acquired_on: "2024-03-15" } },
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("clears the date by sending null when it is emptied", async () => {
    sendJson.mockResolvedValue(ok({}, false));
    render(
      <ul>
        <PurchaseItem lot={lot()} csrfToken="c" />
      </ul>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Edit purchase/ }));
    await userEvent.clear(screen.getByLabelText("Purchase date"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(sendJson.mock.calls[0]![3].body.acquired_on).toBeNull();
  });

  it("shows field problems while editing and stays open", async () => {
    sendJson.mockResolvedValue(
      fail("invalid", "Check the highlighted fields.", {
        shares: "Enter a number of shares above zero, with at most 6 decimals.",
      }),
    );
    const { container } = render(
      <ul>
        <PurchaseItem lot={lot()} csrfToken="c" />
      </ul>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Edit purchase/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByLabelText("Shares")).toBeInvalid();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    await expectNoA11yViolations(container);
  });

  it("cancels an edit without saving anything", async () => {
    render(
      <ul>
        <PurchaseItem lot={lot()} csrfToken="c" />
      </ul>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Edit purchase/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(sendJson).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Edit purchase/ })).toBeInTheDocument();
  });

  it("asks before deleting, and does nothing if the person backs out", async () => {
    render(
      <ul>
        <PurchaseItem lot={lot()} csrfToken="c" />
      </ul>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Delete purchase/ }));
    expect(screen.getByRole("group", { name: /Confirm deleting/ })).toBeInTheDocument();
    expect(sendJson).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(sendJson).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Delete purchase/ })).toBeInTheDocument();
  });

  it("deletes once confirmed, then asks the server for the new list", async () => {
    sendJson.mockResolvedValue(ok(undefined, false));
    render(
      <ul>
        <PurchaseItem lot={lot()} csrfToken="c9" />
      </ul>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Delete purchase/ }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(sendJson).toHaveBeenCalledWith(
      "DELETE",
      "/api/v1/portfolio/lots/11111111-1111-4111-8111-111111111111",
      "c9",
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("treats an already-deleted purchase as done", async () => {
    sendJson.mockResolvedValue(fail("not-found", "We could not find that."));
    render(
      <ul>
        <PurchaseItem lot={lot()} csrfToken="c" />
      </ul>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Delete purchase/ }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps the purchase and says why when the delete fails", async () => {
    sendJson.mockResolvedValue(fail("stale", "This page is out of date. Reload it and try again."));
    render(
      <ul>
        <PurchaseItem lot={lot()} csrfToken="c" />
      </ul>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Delete purchase/ }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(
      await screen.findByText("This page is out of date. Reload it and try again."),
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("HoldingsTable and PurchasesSection", () => {
  const portfolio = {
    holdings: [
      holding("AAPL", "Apple Inc."),
      holding("KO", null, {
        shares: "0.333333",
        average_cost: "3.333333",
        cost_basis: "1.11",
        lots: 1,
      }),
    ],
    total_cost_basis: "1651.11",
    currency: "USD",
  };

  it("shows each holding with exact, tidy figures and the total", async () => {
    const { container } = render(<HoldingsTable portfolio={portfolio} />);

    const apple = screen.getByRole("row", { name: /AAPL/ });
    expect(within(apple).getByText("15")).toBeInTheDocument(); // 15.000000 -> 15
    expect(within(apple).getByText("$110.00")).toBeInTheDocument();
    expect(within(apple).getByText("$1,650.00")).toBeInTheDocument();
    const ko = screen.getByRole("row", { name: /KO/ });
    expect(within(ko).getByText("0.333333")).toBeInTheDocument(); // fractions are not rounded away
    expect(within(ko).getByText("$3.333333")).toBeInTheDocument();
    expect(screen.getByText("$1,651.11")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "AAPL" })).toHaveAttribute("href", "/company/AAPL");
    await expectNoA11yViolations(container);
  });

  it("groups purchases under their company", async () => {
    const lots = [
      lot(),
      lot({ id: "22222222-2222-4222-8222-222222222222", symbol: "KO", shares: "1.000000" }),
      lot({ id: "33333333-3333-4333-8333-333333333333", shares: "5.000000" }),
    ];
    const { container } = render(
      <PurchasesSection holdings={portfolio.holdings} lots={lots} csrfToken="c" />,
    );

    const apple = screen.getByRole("region", { name: /AAPL/ });
    const ko = screen.getByRole("region", { name: /KO/ });
    expect(within(apple).getAllByRole("listitem")).toHaveLength(2);
    expect(within(ko).getAllByRole("listitem")).toHaveLength(1);
    await expectNoA11yViolations(container);
  });
});

describe("portfolio data", () => {
  it("reads the portfolio and the purchases as the visitor", async () => {
    GET.mockResolvedValueOnce({
      data: { holdings: [], total_cost_basis: "0.00", currency: "USD" },
    });
    GET.mockResolvedValueOnce({ data: { lots: [lot()] } });

    expect(await getPortfolio()).toEqual({
      holdings: [],
      total_cost_basis: "0.00",
      currency: "USD",
    });
    expect(await getLots()).toEqual([lot()]);
    expect(GET).toHaveBeenNthCalledWith(1, "/api/v1/portfolio", {
      headers: { cookie: "virello_session=t" },
    });
    expect(GET).toHaveBeenNthCalledWith(2, "/api/v1/portfolio/lots", {
      headers: { cookie: "virello_session=t" },
    });
  });

  it.each(["empty", "throws"])("returns null instead of crashing when the API %s", async (how) => {
    if (how === "throws") GET.mockRejectedValue(new TypeError("fetch failed"));
    else GET.mockResolvedValue({ data: undefined });
    expect(await getPortfolio()).toBeNull();
    expect(await getLots()).toBeNull();
  });
});
