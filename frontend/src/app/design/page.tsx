import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LogoMark } from "@/features/shell";
import { MenuIcon, PaletteIcon, SearchIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/Container";
import { Alert } from "@/components/ui/Alert";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Change } from "@/components/ui/Change";
import { DataCredit } from "@/components/ui/DataCredit";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { TextField } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { LinkButton } from "@/components/ui/LinkButton";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { Ticker } from "@/components/ui/Ticker";
import { isEnabled } from "@/lib/flags";
import { formatCompact, formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";

// An internal review page: not indexed, and a 404 unless the `design` flag is on.
export const metadata: Metadata = { title: "Design", robots: { index: false, follow: false } };

const TOKENS = [
  ["surface", "bg-surface"],
  ["surface-raised", "bg-surface-raised"],
  ["border", "bg-border"],
  ["border-strong", "bg-border-strong"],
  ["fg", "bg-fg"],
  ["fg-muted", "bg-fg-muted"],
  ["brand", "bg-brand"],
  ["gain", "bg-gain"],
  ["loss", "bg-loss"],
  ["focus", "bg-focus"],
] as const;

const TYPE_SCALE = [
  ["text-5xl font-bold", "Display"],
  ["text-3xl font-bold", "Heading 1"],
  ["text-xl font-semibold", "Heading 2"],
  ["text-base", "Body text for reading and data"],
  ["text-sm text-fg-muted", "Secondary and helper text"],
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="border-border border-b pb-2 text-2xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  if (!isEnabled("design")) notFound();

  return (
    <Container className="space-y-12 py-10">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Design gallery</h1>
        <p className="text-fg-muted max-w-2xl">
          Every shared component and state in one place. Use the palette in the nav to check each
          accent, typeface, light and dark mode, and the Motion setting.
        </p>
      </header>

      <Section id="tokens" title="Color tokens">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {TOKENS.map(([name, swatch]) => (
            <li key={name} className="space-y-1.5">
              <span className={`${swatch} border-border block h-14 rounded-lg border`} />
              <span className="text-sm">{name}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="type" title="Typography">
        <div className="space-y-3">
          {TYPE_SCALE.map(([classes, sample]) => (
            <p key={classes} className={classes}>
              {sample}
            </p>
          ))}
          <p className="tabular-nums">Tabular figures line up: 1,111.11 / 8,888.88 / 0,000.00</p>
        </div>
      </Section>

      <Section id="buttons" title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
          <Button loading>Loading</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <LinkButton href="/crypto" variant="secondary">
            Link styled as a button
          </LinkButton>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <IconButton label="Search" variant="secondary">
            <SearchIcon />
          </IconButton>
          <IconButton label="Open menu">
            <MenuIcon />
          </IconButton>
          <IconButton label="Appearance" size="lg">
            <PaletteIcon />
          </IconButton>
        </div>
      </Section>

      <Section id="fields" title="Form fields">
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField label="Coin" hint="For example BTC" placeholder="BTC" />
          <TextField label="Shares" defaultValue="-2" error="Must be greater than zero" />
          <TextField label="Disabled" defaultValue="Read only" disabled />
        </div>
      </Section>

      <Section id="feedback" title="Alerts and states">
        <div className="space-y-3">
          <Alert title="Heads up">Informational message with some detail.</Alert>
          <Alert variant="success" title="Saved">
            Your changes were saved.
          </Alert>
          <Alert variant="error" title="Could not save">
            Check your connection and try again.
          </Alert>
        </div>
        <div className="space-y-2">
          <p className="text-fg-muted text-sm">
            Live messages sit under a button or form and are announced when they appear. Empty ones
            take no space.
          </p>
          <LiveMessage>Could not sign you out. Reload the page and try again.</LiveMessage>
          <LiveMessage tone="success">Added 0.5 BTC.</LiveMessage>
          <LiveMessage />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <EmptyState
              headingLevel={3}
              title="Nothing saved yet"
              description="Add a coin to see it here."
              action={<LinkButton href="/crypto">Browse coins</LinkButton>}
            />
          </Card>
          <Card>
            <ErrorState
              headingLevel={3}
              description="We could not load market data."
              onRetry={undefined}
            />
          </Card>
        </div>
      </Section>

      <Section id="data" title="Data display">
        <div className="flex flex-wrap items-center gap-6">
          <Change value="5.76" />
          <Change value="-3.84" />
          <Change value="0" />
          <Change value={null} />
          <Change kind="money" value="12.3" />
          <Change kind="money" value="-4.5" />
        </div>
        <div className="space-y-2">
          <p className="text-fg-muted text-sm">
            The credit line a data provider requires beside its data: a real link, readable size,
            https only. The second line below has a non-https address, so it stays plain text.
          </p>
          <DataCredit
            text="Data provided by CoinMarketCap.com"
            href="https://coinmarketcap.com/"
            linkText="CoinMarketCap.com"
          />
          <DataCredit
            text="Data provided by Example"
            href="http://insecure.example/"
            linkText="Example"
          />
        </div>
        <div className="space-y-2">
          <p className="text-fg-muted text-sm">
            A slow strip of quotes. It pauses on hover and focus, has a pause button, and does not
            move under Motion Reduced. Prices and the lead-in are supplied by the page. An unknown
            change shows no figure.
          </p>
          <Ticker
            label="Example ticker"
            lead={
              <span className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
                Example
              </span>
            }
            items={[
              { symbol: "AAA", price: "$1,234.50", change: "1.24" },
              { symbol: "BBB", price: "$56.78", change: "-0.62" },
              { symbol: "CCC", price: "$0.0004", change: null },
              { symbol: "DDD", price: "$9.10", change: "0" },
            ]}
            pauseLabel="Pause example ticker"
            playLabel="Play example ticker"
          />
        </div>
        <Card as="div" className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Formatter examples</caption>
            <thead className="border-border border-b">
              <tr>
                <th scope="col" className="p-3 font-semibold">
                  Formatter
                </th>
                <th scope="col" className="p-3 font-semibold">
                  Output
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="border-border border-b">
                <th scope="row" className="p-3 font-normal">
                  formatMoney(&quot;1234.5&quot;)
                </th>
                <td className="p-3">{formatMoney("1234.5")}</td>
              </tr>
              <tr className="border-border border-b">
                <th scope="row" className="p-3 font-normal">
                  formatPercent(5.76, signed)
                </th>
                <td className="p-3">{formatPercent(5.76, { signed: true })}</td>
              </tr>
              <tr className="border-border border-b">
                <th scope="row" className="p-3 font-normal">
                  formatCompact(2500000000000)
                </th>
                <td className="p-3">{formatCompact(2_500_000_000_000)}</td>
              </tr>
              <tr className="border-border border-b">
                <th scope="row" className="p-3 font-normal">
                  formatNumber(&quot;3.14159&quot;, 3)
                </th>
                <td className="p-3">{formatNumber("3.14159", 3)}</td>
              </tr>
              <tr>
                <th scope="row" className="p-3 font-normal">
                  formatDate(&quot;2024-08-01&quot;, long)
                </th>
                <td className="p-3">{formatDate("2024-08-01", "long")}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </Section>

      <Section id="loading" title="Loading placeholders">
        <Card className="space-y-4">
          <p role="status" className="sr-only">
            Loading example
          </p>
          <Skeleton className="h-8 w-1/3" />
          <SkeletonText lines={3} />
        </Card>
      </Section>

      <Section id="brand" title="Brand and motion">
        <div className="flex flex-wrap items-center gap-6">
          <span className="text-brand">
            <LogoMark className="size-12" />
          </span>
          <p className="animate-fade-up">Fade up on load</p>
          <p className="animate-pop-in">Pop in</p>
          <Skeleton className="h-6 w-32" />
          <p className="text-fg-muted text-sm">
            Switch Motion to Reduced in the palette: everything above stops.
          </p>
        </div>
      </Section>
    </Container>
  );
}
