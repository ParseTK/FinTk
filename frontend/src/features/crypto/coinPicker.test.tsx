import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const findCoins = vi.fn();
vi.mock("./actions", () => ({ findCoins: (...args: unknown[]) => findCoins(...args) }));

const { CoinPicker } = await import("./CoinPicker");

const props = { max: 4, basePath: "/resources/tools", param: "compare", hash: "compare" };
const BTC = { slug: "bitcoin", label: "Bitcoin BTC" };
const ETH = { slug: "ethereum", label: "Ethereum ETH" };

beforeEach(() => {
  replace.mockClear();
  findCoins.mockReset();
});

describe("CoinPicker", () => {
  it("has no a11y violations and labels the search for the task", async () => {
    const { container } = render(<CoinPicker selected={[BTC]} {...props} />);
    expect(
      screen.getByRole("combobox", { name: /Add a coin to compare \(up to 4\)/ }),
    ).toBeVisible();
    await expectNoA11yViolations(container);
  });

  it("adds a coin to the address and announces it", async () => {
    findCoins.mockResolvedValue([{ name: "Ethereum", symbol: "ETH", slug: "ethereum" }]);
    const user = userEvent.setup();
    render(<CoinPicker selected={[BTC]} {...props} />);
    await user.type(screen.getByRole("combobox"), "eth");
    await user.click(await screen.findByRole("option", { name: /Ethereum/ }));
    expect(replace).toHaveBeenCalledWith("/resources/tools?compare=bitcoin,ethereum#compare", {
      scroll: false,
    });
    expect(screen.getByText("Added Ethereum. 2 coins selected.")).toBeInTheDocument();
  });

  it("chooses the first suggestion on Enter, without leaving the page", async () => {
    findCoins.mockResolvedValue([{ name: "Ethereum", symbol: "ETH", slug: "ethereum" }]);
    const user = userEvent.setup();
    render(<CoinPicker selected={[]} {...props} />);
    await user.type(screen.getByRole("combobox"), "eth");
    await screen.findByRole("option", { name: /Ethereum/ });
    await user.keyboard("{Enter}");
    expect(replace).toHaveBeenCalledWith("/resources/tools?compare=ethereum#compare", {
      scroll: false,
    });
  });

  it("does not add the same coin twice", async () => {
    findCoins.mockResolvedValue([{ name: "Bitcoin", symbol: "BTC", slug: "bitcoin" }]);
    const user = userEvent.setup();
    render(<CoinPicker selected={[BTC]} {...props} />);
    await user.type(screen.getByRole("combobox"), "bit");
    await user.click(await screen.findByRole("option", { name: /Bitcoin/ }));
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("Bitcoin is already in the comparison.")).toBeInTheDocument();
  });

  it("removes a coin and announces it", async () => {
    const user = userEvent.setup();
    render(<CoinPicker selected={[BTC, ETH]} {...props} />);
    await user.click(screen.getByRole("button", { name: "Remove Ethereum ETH" }));
    expect(replace).toHaveBeenLastCalledWith("/resources/tools?compare=bitcoin#compare", {
      scroll: false,
    });
    expect(screen.getByText("Removed Ethereum ETH. 1 coin selected.")).toBeInTheDocument();
  });

  it("clears the address after the last removal", async () => {
    const user = userEvent.setup();
    render(<CoinPicker selected={[BTC]} {...props} />);
    await user.click(screen.getByRole("button", { name: "Remove Bitcoin BTC" }));
    expect(replace).toHaveBeenCalledWith("/resources/tools#compare", { scroll: false });
  });

  it("stops offering the search at the limit and says why", () => {
    const four = ["a", "b", "c", "d"].map((slug) => ({ slug, label: slug }));
    render(<CoinPicker selected={four} {...props} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText(/4 coins is the most/)).toBeInTheDocument();
  });

  it("names each Remove button starting with its visible text", () => {
    render(<CoinPicker selected={[BTC]} {...props} />);
    const button = screen.getByRole("button", { name: "Remove Bitcoin BTC" });
    expect(button).toHaveTextContent(/^Remove Bitcoin BTC$/);
  });
});
