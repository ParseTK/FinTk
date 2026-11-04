import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";

vi.mock("server-only", () => ({}));

let cookieValue: string | undefined;
const set = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "virello_mode" && cookieValue !== undefined ? { value: cookieValue } : undefined,
    set: (...args: unknown[]) => set(...args),
  }),
}));

// redirect() throws in real Next to stop the action; mimic that so code after it cannot run.
const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

const { getMode, modeHome, modeSwitchActive } = await import("./mode");
const { setMode } = await import("./actions");
const { ModeSwitch } = await import("./ModeSwitch");

const formWith = (mode: unknown) => {
  const data = new FormData();
  if (mode !== undefined) data.set("mode", mode as string);
  return data;
};

beforeEach(() => {
  cookieValue = undefined;
  set.mockReset();
  redirect.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

function switchOn() {
  vi.stubEnv("FEATURE_MODE_SWITCH", "true");
  vi.stubEnv("FEATURE_CRYPTO", "true");
}

describe("modeSwitchActive", () => {
  it("is off by default", () => {
    expect(modeSwitchActive()).toBe(false);
  });

  it("needs both the switch flag and the crypto flag", () => {
    vi.stubEnv("FEATURE_MODE_SWITCH", "true");
    expect(modeSwitchActive()).toBe(false);
    vi.stubEnv("FEATURE_CRYPTO", "true");
    expect(modeSwitchActive()).toBe(true);
    vi.stubEnv("FEATURE_MODE_SWITCH", "false");
    expect(modeSwitchActive()).toBe(false);
  });
});

describe("getMode", () => {
  it("is null while the switch is off, whatever the cookie says", async () => {
    cookieValue = "stocks";
    expect(await getMode()).toBeNull();
  });

  it("defaults to crypto for a first-time visitor", async () => {
    switchOn();
    expect(await getMode()).toBe("crypto");
  });

  it.each(["crypto", "stocks"] as const)("returns the stored mode %s", async (mode) => {
    switchOn();
    cookieValue = mode;
    expect(await getMode()).toBe(mode);
  });

  it.each(["", "CRYPTO", "bonds", "__proto__", "<b>x</b>"])(
    "ignores a bad cookie value (%j)",
    async (value) => {
      switchOn();
      cookieValue = value;
      expect(await getMode()).toBe("crypto");
    },
  );
});

describe("modeHome", () => {
  it("sends Stocks to search and Crypto to the crypto page", () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    expect(modeHome("stocks")).toBe("/search");
    expect(modeHome("crypto")).toBe("/crypto");
  });

  it("never points at the crypto page when it is off", () => {
    expect(modeHome("crypto")).toBe("/");
  });
});

describe("setMode", () => {
  it("remembers the mode for a year, safely, and goes to that mode's home", async () => {
    switchOn();
    await expect(setMode(formWith("stocks"))).rejects.toThrow("NEXT_REDIRECT /search");
    expect(set).toHaveBeenCalledTimes(1);
    const [name, value, options] = set.mock.calls[0]!;
    expect(name).toBe("virello_mode");
    expect(value).toBe("stocks");
    expect(options).toMatchObject({
      path: "/",
      maxAge: 31_536_000,
      sameSite: "lax",
      httpOnly: true,
    });
  });

  it("goes to the crypto page for Crypto", async () => {
    switchOn();
    await expect(setMode(formWith("crypto"))).rejects.toThrow("NEXT_REDIRECT /crypto");
    expect(set.mock.calls[0]![1]).toBe("crypto");
  });

  it("is Secure in production", async () => {
    switchOn();
    vi.stubEnv("NODE_ENV", "production");
    await expect(setMode(formWith("crypto"))).rejects.toThrow("NEXT_REDIRECT");
    expect(set.mock.calls[0]![2]).toMatchObject({ secure: true });
  });

  it.each([undefined, "", "bonds", "CRYPTO", "<script>", "__proto__", "stocks,crypto"])(
    "ignores an unknown value (%j): no cookie, no redirect",
    async (value) => {
      switchOn();
      await setMode(formWith(value));
      expect(set).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    },
  );

  it("ignores a file upload in the mode field", async () => {
    switchOn();
    const data = new FormData();
    data.set("mode", new File(["crypto"], "crypto.txt"));
    await setMode(data);
    expect(set).not.toHaveBeenCalled();
  });

  it("does nothing while the switch is off", async () => {
    await setMode(formWith("stocks"));
    expect(set).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("ModeSwitch", () => {
  it("is a labelled group with a toggle button per mode", () => {
    render(<ModeSwitch mode="crypto" />);
    const group = screen.getByRole("group", { name: "Show" });
    expect(
      within(group)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Crypto", "Stocks"]);
  });

  it.each([
    ["crypto", "true", "false"],
    ["stocks", "false", "true"],
  ] as const)("marks only the current mode as pressed (%s)", (mode, crypto, stocks) => {
    render(<ModeSwitch mode={mode} />);
    expect(screen.getByRole("button", { name: "Crypto" })).toHaveAttribute("aria-pressed", crypto);
    expect(screen.getByRole("button", { name: "Stocks" })).toHaveAttribute("aria-pressed", stocks);
  });

  it("posts the chosen mode, from a real submit button, so it works without JavaScript", () => {
    render(<ModeSwitch mode="crypto" />);
    for (const name of ["Crypto", "Stocks"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveAttribute("type", "submit");
      const form = button.closest("form")!;
      expect((form.querySelector("input[name=mode]") as HTMLInputElement).value).toBe(
        name.toLowerCase(),
      );
    }
  });

  it("has no accessibility violations in either mode", async () => {
    for (const mode of ["crypto", "stocks"] as const) {
      const { container, unmount } = render(<ModeSwitch mode={mode} />);
      await expectNoA11yViolations(container);
      unmount();
    }
  });
});
