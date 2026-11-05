import clsx from "clsx";

export interface DataCreditProps {
  /** The full credit line, for example "Data provided by CoinMarketCap.com". */
  text: string;
  /** Where the credit links to. Anything that is not an https address is shown as plain text. */
  href: string;
  /** The part of `text` that becomes the link. Without it, the whole line is the link. */
  linkText?: string;
  className?: string;
}

/**
 * The credit line a data provider's licence requires next to its data, with a hyperlink to them.
 * The text and address come from the API response, so a page cannot forget or alter them. It is a
 * real link (never rel="nofollow"), at a readable size, and only https addresses are linked.
 */
export function DataCredit({ text, href, linkText, className }: DataCreditProps) {
  const safe = href.startsWith("https://");
  const at = linkText ? text.indexOf(linkText) : -1;
  const link = (label: string) =>
    safe ? (
      <a
        href={href}
        rel="noopener noreferrer"
        className="text-brand font-medium underline underline-offset-2"
      >
        {label}
      </a>
    ) : (
      <span>{label}</span>
    );

  return (
    <p className={clsx("text-fg text-sm", className)}>
      {linkText && at >= 0 ? (
        <>
          {text.slice(0, at)}
          {link(linkText)}
          {text.slice(at + linkText.length)}
        </>
      ) : (
        link(text)
      )}
    </p>
  );
}
