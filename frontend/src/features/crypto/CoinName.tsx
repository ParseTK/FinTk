import Link from "next/link";

/**
 * A coin's name and symbol, as a link to its page when `href` is given. The link text is the name
 * alone; the symbol stays outside it so a screen reader's link list reads "Bitcoin", not "Bitcoin BTC".
 */
export function CoinName({ name, symbol, href }: { name: string; symbol: string; href?: string }) {
  return (
    <>
      {href ? (
        <Link href={href} className="font-medium underline-offset-2 hover:underline">
          {name}
        </Link>
      ) : (
        <span className="font-medium">{name}</span>
      )}{" "}
      <span className="text-fg-muted text-sm">{symbol}</span>
    </>
  );
}

/** The address of a coin's page. */
export const coinHref = (slug: string) => `/crypto/coins/${slug}`;
