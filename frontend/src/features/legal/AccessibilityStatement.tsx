import { ExternalLink } from "@/components/ui/ExternalLink";
import { SITE } from "@/lib/site";
import { Bullets, LegalPage, type LegalSection } from "./LegalPage";
import { LEGAL_UPDATED } from "./updated";

const SECTIONS: readonly LegalSection[] = [
  {
    id: "goal",
    title: "Our goal",
    body: (
      <p>
        Virello aims to meet the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA, and to
        move to 2.2 AA. That means the whole site can be used with a keyboard, with a screen reader,
        with zoom or large text, and with reduced motion.
      </p>
    ),
  },
  {
    id: "built",
    title: "What is built in",
    body: (
      <Bullets
        items={[
          "Every page has one main heading, landmarks, and a skip link to the main content.",
          "Everything can be reached and used with the keyboard, with a visible focus outline.",
          "Text and interface colors are checked against the AA contrast ratios in both the dark and light themes and for every accent color.",
          "The layout adapts down to a 320 pixel wide screen without sideways scrolling.",
          "Motion can be set to reduced from the display menu, and follows your device setting by default. Nothing flashes.",
          "Forms have labels, and errors are announced and moved to. Results that update are announced politely.",
          "Charts and bars always come with their figures as text, so color is never the only signal.",
        ]}
      />
    ),
  },
  {
    id: "tested",
    title: "How it is checked",
    body: (
      <p>
        Every change runs automated accessibility tests, and each page was checked with the axe
        engine and Lighthouse in both themes at phone, tablet and desktop widths. Automated tools
        find only some problems.
      </p>
    ),
  },
  {
    id: "limits",
    title: "Known limits",
    body: (
      <Bullets
        items={[
          "The site has not yet been tested by people who use screen readers day to day. If something is hard to use with one, please say so.",
          "A few links that stand on their own are shorter than the 24 pixel target size in WCAG 2.2. They are inline-sized for reading and are being enlarged.",
          "Links to other sites open in a new tab. This is announced in the link text.",
        ]}
      />
    ),
  },
  {
    id: "feedback",
    title: "Tell us about a problem",
    body: (
      <p>
        If something on Virello is hard to use, open an issue on the{" "}
        <ExternalLink href={SITE.issuesUrl}>project&apos;s GitHub page</ExternalLink> and describe
        the page and what happened. Please do not include personal information. Accessibility
        problems are treated as bugs.
      </p>
    ),
  },
];

export function AccessibilityStatement() {
  return (
    <LegalPage
      title="Accessibility statement"
      updated={LEGAL_UPDATED}
      intro={
        <p>
          Virello should be usable by everyone. This page says what we aim for, what is already in
          place, and where it still falls short.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
