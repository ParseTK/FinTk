import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { DataCredit } from "./DataCredit";

const TEXT = "Data provided by CoinMarketCap.com";
const URL = "https://coinmarketcap.com/";

describe("DataCredit", () => {
  it("shows the whole credit line with only the provider's name as the link", () => {
    const { container } = render(
      <DataCredit text={TEXT} href={URL} linkText="CoinMarketCap.com" />,
    );
    expect(container).toHaveTextContent(TEXT);
    const link = screen.getByRole("link", { name: "CoinMarketCap.com" });
    expect(link).toHaveAttribute("href", URL);
  });

  it("links the whole line when no link text is given", () => {
    render(<DataCredit text={TEXT} href={URL} />);
    expect(screen.getByRole("link", { name: TEXT })).toHaveAttribute("href", URL);
  });

  it("links the whole line when the link text is not part of it", () => {
    render(<DataCredit text={TEXT} href={URL} linkText="Somewhere Else" />);
    expect(screen.getByRole("link", { name: TEXT })).toBeInTheDocument();
  });

  it("is a real link that opens safely and is not marked nofollow", () => {
    render(<DataCredit text={TEXT} href={URL} linkText="CoinMarketCap.com" />);
    const rel = screen.getByRole("link").getAttribute("rel") ?? "";
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");
    expect(rel).not.toContain("nofollow");
  });

  it.each([
    "javascript:alert(1)",
    "http://coinmarketcap.com/",
    "//coinmarketcap.com/",
    "",
    "data:x",
  ])("never links a non-https address (%s) but still shows the credit", (href) => {
    const { container } = render(
      <DataCredit text={TEXT} href={href} linkText="CoinMarketCap.com" />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container).toHaveTextContent(TEXT);
  });

  it("shows markup in the text as text", () => {
    const { container } = render(
      <DataCredit text="<img src=x onerror=alert(1)> by CMC" href={URL} linkText="CMC" />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("<img src=x onerror=alert(1)> by CMC");
  });

  it("is readable: not the smallest text size", () => {
    const { container } = render(<DataCredit text={TEXT} href={URL} />);
    expect(container.firstElementChild).toHaveClass("text-sm");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <DataCredit text={TEXT} href={URL} linkText="CoinMarketCap.com" />,
    );
    await expectNoA11yViolations(container);
  });
});
