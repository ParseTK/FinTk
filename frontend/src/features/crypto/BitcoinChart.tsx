import { Change } from "@/components/ui/Change";
import { DataCredit } from "@/components/ui/DataCredit";
import { priceSeries, spanLabel, type PriceSeries } from "./bitcoinSeries";
import { formatCoinPrice } from "./crypto";
import type { CryptoMarkets } from "./types";

const W = 480;
const H = 220;
const PAD = { left: 4, right: 12, top: 14, bottom: 26 };
const GRID_LINES = 4;

/** Map the series onto the drawing: x by how long ago, y between its own low and high. */
function layout(series: PriceSeries) {
  const prices = series.points.map((point) => point.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const margin = (high - low || high) * 0.1;
  const min = low - margin;
  const max = high + margin;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const coords = series.points.map(({ daysAgo, price }) => ({
    x: PAD.left + ((series.spanDays - daysAgo) / series.spanDays) * plotW,
    y: PAD.top + (1 - (price - min) / (max - min)) * plotH,
  }));
  const line = coords.map(({ x, y }, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  const last = coords[coords.length - 1]!;
  const first = coords[0]!;
  const baseline = (H - PAD.bottom).toFixed(1);
  return {
    d: line.join(" "),
    area: `${line.join(" ")} L${last.x.toFixed(1)},${baseline} L${first.x.toFixed(1)},${baseline} Z`,
    end: last,
    gridY: Array.from({ length: GRID_LINES }, (_, i) => PAD.top + (plotH / (GRID_LINES - 1)) * i),
  };
}

/**
 * Bitcoin's price over the past year as a plain, restrained line chart: a thin line, a faint grid,
 * a soft fill and a small dot for today. The line is drawn through a few real, dated points worked
 * out from the changes the API reports (see priceSeries), and the figure says so. It reads colors
 * from the theme tokens, so it follows the accent and light and dark mode. Shows nothing when the
 * figures cannot be had.
 */
export function BitcoinChart({ markets }: { markets: CryptoMarkets | null }) {
  const coin = markets?.majors.find((major) => major.symbol === "BTC");
  if (!markets || !coin) return null;
  const series = priceSeries(
    coin,
    { yearStart: markets.year_start, pastYearStart: markets.past_year_start },
    markets.as_of,
  );
  if (!series) return null;

  const { d, area, end, gridY } = layout(series);
  const span = spanLabel(series.spanDays);
  const price = formatCoinPrice(coin.price);
  const summary = `Bitcoin price over the ${span}, now ${price}, ${
    Number(series.spanChange) >= 0 ? "up" : "down"
  } ${Math.abs(Number(series.spanChange)).toFixed(2)} percent over the period.`;

  return (
    <figure className="border-border bg-surface-raised/70 rounded-2xl border p-5">
      <figcaption className="space-y-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
              Bitcoin · {span}
            </p>
            <p className="text-3xl font-bold tabular-nums">{price}</p>
          </div>
          <div className="text-right">
            <Change value={series.spanChange} className="text-lg" />
            <p className="text-fg-muted text-xs">{span}</p>
          </div>
        </div>
      </figcaption>

      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-auto w-full"
        focusable="false"
      >
        <defs>
          <linearGradient id="btc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridY.map((y) => (
          <line
            key={y}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y}
            y2={y}
            stroke="var(--border)"
            strokeDasharray="3 5"
          />
        ))}
        <path d={area} fill="url(#btc-area)" />
        <path
          d={d}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={end.x}
          cy={end.y}
          r="3.5"
          fill="var(--brand)"
          stroke="var(--surface)"
          strokeWidth="2"
        />
        <g fill="var(--fg-muted)" fontSize="11">
          <text x={PAD.left} y={H - 6}>
            {series.spanDays >= 330 ? "1 year ago" : `${series.spanDays} days ago`}
          </text>
          <text x={W - PAD.right} y={H - 6} textAnchor="end">
            Now
          </text>
        </g>
      </svg>

      <p className="text-fg-muted mt-2 text-xs">
        Drawn through Bitcoin&apos;s price now and its changes over 24 hours, 7, 30 and 90 days, the
        year so far and the past year. It is not a full price history.
      </p>
      <DataCredit
        text={markets.attribution.text}
        href={markets.attribution.url}
        linkText="CoinMarketCap.com"
        className="mt-2"
      />
    </figure>
  );
}
