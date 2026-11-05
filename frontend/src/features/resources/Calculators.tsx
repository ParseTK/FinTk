"use client";

import { Change } from "@/components/ui/Change";
import { formatMoney } from "@/lib/format";
import { breakEven, gainLoss, percentChange } from "./toolMath";
import { ToolForm, type Outcome } from "./ToolForm";

const withSign = (text: string) => (/^-/.test(text) || /^0(\.0+)?$/.test(text) ? text : `+${text}`);

const computePercentChange = (values: Record<string, string>): Outcome => {
  const result = percentChange(values.start ?? "", values.end ?? "");
  if (!result.ok) return result;
  return {
    ok: true,
    lines: [
      { label: "Difference", value: withSign(result.value.difference) },
      { label: "Change", value: <Change value={result.value.percent} /> },
    ],
  };
};

const computeGainLoss = (values: Record<string, string>): Outcome => {
  const result = gainLoss(values.amount ?? "", values.paid ?? "", values.price ?? "");
  if (!result.ok) return result;
  return {
    ok: true,
    lines: [
      { label: "Worth now", value: formatMoney(result.value.value) },
      { label: "Gain or loss", value: <Change kind="money" value={result.value.gain} /> },
      { label: "As a percent of what you paid", value: <Change value={result.value.percent} /> },
    ],
  };
};

const computeBreakEven = (values: Record<string, string>): Outcome => {
  const result = breakEven(values.fall ?? "");
  if (!result.ok) return result;
  return {
    ok: true,
    lines: [{ label: "Rise needed", value: <Change value={result.value.rise} /> }],
    note: `After a fall of ${(values.fall ?? "").trim()} percent, a rise of ${result.value.rise} percent is needed to get back to where it started. This is arithmetic, not a forecast.`,
  };
};

export function PercentChangeCalculator() {
  return (
    <ToolForm
      title="Percentage change"
      description="How much a number has changed, as a percentage of where it started. Use it for a price, a market value or any two figures."
      fields={[
        { name: "start", label: "Starting value", placeholder: "80" },
        { name: "end", label: "Ending value", placeholder: "100" },
      ]}
      compute={computePercentChange}
    />
  );
}

export function GainLossCalculator() {
  return (
    <ToolForm
      title="Gain or loss"
      description="What a holding is worth now compared with what you paid for it, worked out the same way as the holdings page. Amounts are in US dollars."
      fields={[
        { name: "amount", label: "Amount you hold", hint: "Number of coins.", placeholder: "0.5" },
        {
          name: "paid",
          label: "Total you paid",
          hint: "In US dollars, for everything you hold.",
          placeholder: "20000",
        },
        {
          name: "price",
          label: "Price of one coin now",
          hint: "In US dollars.",
          placeholder: "45000",
        },
      ]}
      compute={computeGainLoss}
    />
  );
}

export function BreakEvenCalculator() {
  return (
    <ToolForm
      title="Rise needed after a fall"
      description="After a holding falls, the rise needed to get back to where it started is larger than the fall. Enter the fall to see by how much."
      fields={[
        {
          name: "fall",
          label: "Fall, in percent",
          hint: "A number above 0 and below 100.",
          placeholder: "50",
        },
      ]}
      compute={computeBreakEven}
    />
  );
}
