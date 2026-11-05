/**
 * What a person typed for a decimal, tidied before it is sent: spaces trimmed and a missing leading
 * zero added (".0542" and "5." both mean what they say). Anything else is left for the server to judge.
 */
export function tidyDecimal(value: string): string {
  const trimmed = value.trim();
  const withZero = trimmed.startsWith(".") ? `0${trimmed}` : trimmed;
  return /^\d+\.$/.test(withZero) ? withZero.slice(0, -1) : withZero;
}

/**
 * A coin amount for display, from the exact string the API sent: thousands separators in the whole
 * part, the decimals exactly as stored (a number type would round an 18 decimal amount). "1.5",
 * "2000", "0.000000000000000001". Anything that is not a plain decimal comes back as a dash.
 */
export function formatAmount(value: string | null | undefined): string {
  if (value == null || !/^\d+(\.\d+)?$/.test(value)) return "—";
  const [whole, decimals] = value.split(".") as [string, string | undefined];
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimals === undefined ? grouped : `${grouped}.${decimals}`;
}
