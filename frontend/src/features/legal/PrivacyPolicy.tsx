import { ExternalLink } from "@/components/ui/ExternalLink";
import { SITE } from "@/lib/site";
import { Bullets, LegalPage, type LegalSection } from "./LegalPage";
import { LEGAL_UPDATED } from "./updated";

const SECTIONS: readonly LegalSection[] = [
  {
    id: "who",
    title: "Who runs Virello",
    body: (
      <>
        <p>
          Virello is a personal, non-commercial project by an individual developer. It is not a
          company and it does not sell anything. There is no advertising, no tracking and no
          analytics on this site.
        </p>
        <p>
          To ask a question about this policy, open an issue on the{" "}
          <ExternalLink href={SITE.issuesUrl}>project&apos;s GitHub page</ExternalLink> and do not
          put personal information in it. To report a security problem privately, use{" "}
          <ExternalLink href={SITE.securityReportUrl}>GitHub private reporting</ExternalLink>. You
          can delete your own account at any time without asking anyone (see the Deleting your data
          section).
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "What is stored about you",
    body: (
      <>
        <p>
          You can read all of the research pages without an account. If you sign in, Virello stores:
        </p>
        <Bullets
          items={[
            <>
              <strong>From Google or GitHub:</strong> your email address, your display name, the
              address of your profile picture, which provider you used and your ID at that provider.
              Virello asks those providers only for that basic profile and your email. It never
              receives your password and cannot act on your Google or GitHub account.
            </>,
            <>
              <strong>What you enter:</strong> the coins on your watchlist, and for each holding the
              coin, the amount and, if you choose to give it, the total you paid. Virello does not
              connect to any exchange or wallet, so nothing else about your holdings is known.
            </>,
            <>
              <strong>Your sign-in:</strong> a random token kept in a cookie. Only a one-way hash of
              the token is stored on the server, so a copy of the database cannot be used to sign in
              as you.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "device",
    title: "Cookies and your device",
    body: (
      <>
        <Bullets
          items={[
            <>
              <strong>Sign-in cookie.</strong> Kept while you are signed in. Scripts on the page
              cannot read it. It expires after 30 days without a visit, and after 90 days in all,
              which asks you to sign in again.
            </>,
            <>
              <strong>Sign-in step cookie.</strong> A short-lived cookie (about ten minutes) used
              while you are being sent to Google or GitHub and back, to make sure the reply belongs
              to your request.
            </>,
            <>
              <strong>Display choices.</strong> Your theme, accent color, typeface and motion
              setting are saved in your browser&apos;s own storage on your device. They are never
              sent to Virello&apos;s servers.
            </>,
          ]}
        />
        <p>
          These are all needed for the site to work as you asked, so there is no cookie banner. No
          advertising or tracking cookies are used.
        </p>
      </>
    ),
  },
  {
    id: "logs",
    title: "Technical logs",
    body: (
      <p>
        Servers keep short technical logs so problems can be fixed: the time, the page requested,
        the result and a random request number. Virello&apos;s logs leave out the part of a web
        address after the question mark, your sign-in token and anything you type into a form. The
        companies that host the site may keep their own technical logs under their own policies.
      </p>
    ),
  },
  {
    id: "sharing",
    title: "Who else sees it",
    body: (
      <>
        <p>
          Your information is not sold or shared for marketing. It is handled only by the services
          needed to run the site: Google or GitHub when you choose to sign in with them, and the
          companies that host the site and its database.
        </p>
        <p>
          Market figures come from CoinMarketCap and news from official government feeds. Virello
          requests those from its own servers, so those providers are never told who you are or what
          you look at.
        </p>
      </>
    ),
  },
  {
    id: "delete",
    title: "Deleting your data",
    body: (
      <>
        <p>
          Open your account page and choose Delete my account. This removes your account, your
          sign-ins, every active session, your watchlist and your holdings, immediately and
          permanently. Signing out removes only the current session.
        </p>
        <p>
          If the host keeps backups of the database, a deleted account can remain in an older backup
          until that backup expires under the host&apos;s schedule. It is never restored into the
          live site.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        Virello is not meant for children under 13 and does not knowingly collect their information.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        If what is stored or how it is used changes, this page is updated and the date at the top
        changes with it. Earlier versions are in the project&apos;s public history on GitHub.
      </p>
    ),
  },
];

export function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy policy"
      updated={LEGAL_UPDATED}
      intro={
        <p>
          What Virello stores about you, why, and how to remove it. In short: a little, only if you
          sign in, and you can delete all of it yourself.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
