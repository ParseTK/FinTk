import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { signInErrorMessage } from "./messages";

vi.mock("server-only", () => ({}));

const goTo = vi.fn();
vi.mock("./navigate", () => ({ goTo: (path: string) => goTo(path) }));

const sendWithCsrf = vi.fn();
vi.mock("@/lib/apiRequest", () => ({
  sendWithCsrf: (...args: unknown[]) => sendWithCsrf(...args),
}));

const getSession = vi.fn();
vi.mock("./session", () => ({ getSession: () => getSession() }));

const { AccountDetails } = await import("./AccountDetails");
const { AccountMenu } = await import("./AccountMenu");
const { AccountMenuView, initials } = await import("./AccountMenuView");
const { DeleteAccount } = await import("./DeleteAccount");
const { SignInPanel } = await import("./SignInPanel");
const { SignOutButton } = await import("./SignOutButton");

const user = { id: "u1", email: "octo@example.com", name: "Octo Cat", avatar_url: null };

beforeEach(() => {
  goTo.mockReset();
  sendWithCsrf.mockReset();
  getSession.mockReset();
});

describe("SignInPanel", () => {
  it("offers a link per configured provider that carries the destination", async () => {
    const { container } = render(
      <SignInPanel providers={["github", "google"]} next="/company/AAPL" />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Sign in to Virello" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue with GitHub" })).toHaveAttribute(
      "href",
      "/api/v1/auth/github/login?next=%2Fcompany%2FAAPL",
    );
    expect(screen.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
      "href",
      "/api/v1/auth/google/login?next=%2Fcompany%2FAAPL",
    );
    await expectNoA11yViolations(container);
  });

  it("URL-encodes the destination so it cannot break out of the query string", () => {
    render(<SignInPanel providers={["github"]} next="/search?q=a&b=c#x" />);
    expect(screen.getByRole("link", { name: /GitHub/ })).toHaveAttribute(
      "href",
      "/api/v1/auth/github/login?next=%2Fsearch%3Fq%3Da%26b%3Dc%23x",
    );
  });

  it("never turns a provider name it does not know into a link", () => {
    render(<SignInPanel providers={["github", "evil/../x", "javascript:alert(1)"]} next="/" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("explains each known failure in plain words", async () => {
    const { container } = render(<SignInPanel providers={["github"]} next="/" error="denied" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in was cancelled");
    await expectNoA11yViolations(container);
  });

  it("never echoes an unknown error value into the page", () => {
    const hostile = "<img src=x onerror=alert(1)>";
    const { container } = render(<SignInPanel providers={["github"]} next="/" error={hostile} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain("onerror");
  });

  it("says so when no sign-in method is configured", () => {
    render(<SignInPanel providers={[]} next="/" />);
    expect(screen.getByRole("status")).toHaveTextContent("not available yet");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("says so when the API cannot be reached", () => {
    render(<SignInPanel providers={[]} next="/" reachable={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("Sign-in is unavailable");
  });
});

describe("signInErrorMessage", () => {
  it.each(["denied", "invalid", "failed", "unverified", "unavailable"])("knows %s", (code) => {
    expect(signInErrorMessage(code)).toEqual(expect.any(String));
  });

  it.each([undefined, "", "nope", "__proto__", "constructor", "toString", ["denied"]])(
    "handles %j without throwing",
    (code) => {
      expect(() => signInErrorMessage(code as string)).not.toThrow();
    },
  );

  it("is not fooled by names from the object prototype", () => {
    expect(signInErrorMessage("constructor")).toBeNull();
    expect(signInErrorMessage("__proto__")).toBeNull();
  });
});

describe("initials", () => {
  it.each([
    [{ name: "Octo Cat", email: "x@y.z" }, "OC"],
    [{ name: "Ada Augusta King", email: "x@y.z" }, "AK"],
    [{ name: "Prince", email: "x@y.z" }, "PR"],
    [{ name: null, email: "zed@example.com" }, "ZE"],
    [{ name: "   ", email: "mia@example.com" }, "MI"],
  ])("derives %j as %s", (input, expected) => {
    expect(initials(input)).toBe(expected);
  });
});

describe("AccountMenu (header)", () => {
  it("shows a Sign in link to visitors", async () => {
    getSession.mockResolvedValue({ user: null, csrfToken: null, providers: [], reachable: true });
    render(await AccountMenu());
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  });

  it("still shows Sign in when the API is unreachable, instead of breaking the header", async () => {
    getSession.mockResolvedValue({ user: null, csrfToken: null, providers: [], reachable: false });
    render(await AccountMenu());
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows the account menu button to a signed-in person", async () => {
    getSession.mockResolvedValue({ user, csrfToken: "c", providers: ["github"], reachable: true });
    render(await AccountMenu());
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });
});

describe("AccountMenuView", () => {
  it("opens to show who is signed in, a link to the account and a sign out button", async () => {
    const { container } = render(<AccountMenuView user={user} csrfToken="c" />);
    const button = screen.getByRole("button", { name: "Account menu" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("octo@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your account" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("draws the initials as decoration, so the visible label does not clash with the name", () => {
    render(<AccountMenuView user={user} csrfToken="c" />);
    const button = screen.getByRole("button", { name: "Account menu" });
    // No text node inside the button: the letters come from CSS (WCAG 2.5.3 Label in Name).
    expect(button).toBeEmptyDOMElement();
    expect(button).toHaveAttribute("data-initials", initials(user));
  });

  it("links to the watchlist, the portfolio and the account, in that order", async () => {
    render(<AccountMenuView user={user} csrfToken="c" />);
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));

    const links = screen
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")]);

    expect(links).toEqual([
      ["Watchlist", "/watchlist"],
      ["Portfolio", "/portfolio"],
      ["Your account", "/account"],
    ]);
    expect(screen.getByRole("navigation", { name: "Your pages" })).toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the button", async () => {
    render(<AccountMenuView user={user} csrfToken="c" />);
    const button = screen.getByRole("button", { name: "Account menu" });
    await userEvent.click(button);
    await userEvent.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  it("never loads a picture from another site", () => {
    const { container } = render(
      <AccountMenuView
        user={{ ...user, avatar_url: "https://tracker.example/pixel.png" }}
        csrfToken="c"
      />,
    );
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("SignOutButton", () => {
  it("signs out with the CSRF token, then does a full reload home", async () => {
    sendWithCsrf.mockResolvedValue("ok");
    render(<SignOutButton csrfToken="csrf-xyz" />);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(sendWithCsrf).toHaveBeenCalledWith("POST", "/api/v1/auth/logout", "csrf-xyz");
    expect(goTo).toHaveBeenCalledWith("/");
  });

  it("treats an already-ended session as signed out", async () => {
    sendWithCsrf.mockResolvedValue("signed-out");
    render(<SignOutButton csrfToken="c" />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(goTo).toHaveBeenCalledWith("/");
  });

  it.each(["stale", "failed"])("tells the person and stays put when it is %s", async (result) => {
    sendWithCsrf.mockResolvedValue(result);
    render(<SignOutButton csrfToken="c" />);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not sign you out");
    expect(goTo).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
  });
});

describe("DeleteAccount", () => {
  it("asks first, and defaults focus to the safe choice", async () => {
    const { container } = render(<DeleteAccount csrfToken="c" />);
    expect(screen.queryByRole("button", { name: /Yes, delete/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(sendWithCsrf).not.toHaveBeenCalled();
    await expectNoA11yViolations(container);
  });

  it("goes back without deleting anything when cancelled", async () => {
    render(<DeleteAccount csrfToken="c" />);
    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete my account" })).toBeInTheDocument();
    expect(sendWithCsrf).not.toHaveBeenCalled();
  });

  it("deletes with the CSRF token and goes home once confirmed", async () => {
    sendWithCsrf.mockResolvedValue("ok");
    render(<DeleteAccount csrfToken="csrf-del" />);

    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete my account" }));

    expect(sendWithCsrf).toHaveBeenCalledWith("DELETE", "/api/v1/me", "csrf-del");
    expect(goTo).toHaveBeenCalledWith("/");
  });

  it("reports a failure and keeps the account", async () => {
    sendWithCsrf.mockResolvedValue("failed");
    render(<DeleteAccount csrfToken="c" />);

    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete my account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not delete your account");
    expect(goTo).not.toHaveBeenCalled();
  });
});

describe("AccountDetails", () => {
  it("shows the profile, and degrades when there is no name", async () => {
    const { container, rerender } = render(<AccountDetails user={user} />);
    expect(screen.getByText("Octo Cat")).toBeInTheDocument();
    expect(screen.getByText("octo@example.com")).toBeInTheDocument();
    await expectNoA11yViolations(container);

    rerender(<AccountDetails user={{ ...user, name: null }} />);
    expect(screen.getByText("Not provided")).toBeInTheDocument();
  });
});
