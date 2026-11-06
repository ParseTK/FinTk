import Link from "next/link";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { SITE } from "@/lib/site";
import { Bullets, LegalPage, type LegalSection } from "./LegalPage";
import { LEGAL_UPDATED } from "./updated";

const SECTIONS: readonly LegalSection[] = [
  {
    id: "use",
    title: "Personal, non-commercial use",
    body: (
      <>
        <p>
          FinTk is a free project made for learning and research, and it is for personal,
          non-commercial use only. Please do not use it, or anything you take from it, in a
          business, to run a service for others, or for any paid purpose.
        </p>
        <p>
          By using the site you agree to these terms. If you do not agree, please do not use it.
        </p>
      </>
    ),
  },
  {
    id: "advice",
    title: "Not investment advice",
    body: (
      <>
        <p>
          Everything on FinTk is information, shown as published, for research and education. It is
          not investment, financial, tax or legal advice, and nothing here recommends buying,
          selling or holding anything. Digital assets are volatile and you can lose money.
        </p>
        <p>
          Figures can be delayed, incomplete or wrong, and a coin&apos;s price on another site may
          differ. Check anything that matters at its source, and speak to a qualified professional
          before making a financial decision. Gains and losses shown for your holdings are simple
          arithmetic on what you typed in; they ignore fees, taxes and anything you did not enter.
        </p>
      </>
    ),
  },
  {
    id: "data",
    title: "Data from other sources",
    body: (
      <>
        <p>
          Market data is provided by{" "}
          <ExternalLink href="https://coinmarketcap.com/">CoinMarketCap.com</ExternalLink>. News and
          announcements come from official public feeds of the U.S. Securities and Exchange
          Commission, the Commodity Futures Trading Commission and the Department of Justice, and
          from company filings on SEC EDGAR. Those sources own their data and their own terms apply
          to it. FinTk is not endorsed by any of them. The Data &amp; methodology page explains each
          figure.
        </p>
        <p>
          Market data is shown only inside FinTk&apos;s own pages, for you to read. Please do not
          copy it in bulk, scrape it, resell it or republish it.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts and what you enter",
    body: (
      <>
        <p>
          Signing in is optional and uses your Google or GitHub account. You are responsible for
          what happens under your sign-in, so keep access to those accounts secure. What you put in
          your watchlist and holdings is yours: FinTk uses it only to show it back to you. You can
          delete your account, and everything stored with it, at any time. The{" "}
          <Link
            href="/privacy"
            className="text-brand underline underline-offset-2 hover:no-underline"
          >
            privacy policy
          </Link>{" "}
          explains what is stored.
        </p>
        <p>An account may be removed if it is used to abuse the site.</p>
      </>
    ),
  },
  {
    id: "rules",
    title: "Fair use",
    body: (
      <>
        <p>Please do not:</p>
        <Bullets
          items={[
            "attack, overload or try to break into the site or its servers",
            "use automated tools to collect data from it, or to get around its limits",
            "use someone else's account, or try to read or change another person's information",
            "use the site for anything unlawful",
          ]}
        />
        <p>
          If you find a security problem, please report it privately through{" "}
          <ExternalLink href={SITE.securityReportUrl}>GitHub private reporting</ExternalLink> so it
          can be fixed before it is made public.
        </p>
      </>
    ),
  },
  {
    id: "warranty",
    title: "No warranty and limits on liability",
    body: (
      <>
        <p>
          FinTk is offered free and as is, with no promise that it will be available, accurate,
          complete or suitable for any purpose. It can change, pause or stop at any time.
        </p>
        <p>
          To the fullest extent the law allows, the person who runs FinTk is not liable for any loss
          or damage that comes from using it or relying on it, including financial loss. Nothing
          here limits rights you have by law that cannot be limited.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes",
    body: (
      <p>
        These terms may be updated. The date at the top shows the latest change, and earlier
        versions are in the project&apos;s public history on GitHub. Using the site after a change
        means you accept the new terms.
      </p>
    ),
  },
];

export function TermsOfUse() {
  return (
    <LegalPage
      title="Terms of use"
      updated={LEGAL_UPDATED}
      intro={
        <p>
          The short version: FinTk is a free research tool for personal use. It is information, not
          advice, and it comes without guarantees.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
