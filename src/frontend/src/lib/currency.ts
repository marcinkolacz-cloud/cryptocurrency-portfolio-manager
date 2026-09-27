/**
 * Shared currency formatting for the portfolio dashboard.
 *
 * USD is the primary/default display currency. When a USD -> PLN exchange
 * rate is available, every monetary value also renders its PLN equivalent
 * automatically beneath the USD value. There is no currency toggle.
 */

export const USD_CURRENCY = "USD" as const;
export const PLN_CURRENCY = "PLN" as const;

/** Fallback USD -> PLN rate used only when the backend rate is unavailable. */
export const FALLBACK_USD_TO_PLN_RATE = 4.0;

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: USD_CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdCompactFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: USD_CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const plnFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: PLN_CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plnCompactFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: PLN_CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export interface CurrencyFormatOptions {
  /** Round to whole units (used by chart axes and compact labels). */
  compact?: boolean;
  /** Prefix a sign for positive values (used by P&L figures). */
  showSign?: boolean;
}

export interface FormattedMoney {
  /** Primary USD string, e.g. "$1,234.56". */
  usd: string;
  /** PLN equivalent string, or null when no rate is available. */
  pln: string | null;
}

function isUsableRate(rate: number | null | undefined): rate is number {
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0;
}

/** Format a USD amount as the primary display string. */
export function formatUsd(
  amount: number,
  options: CurrencyFormatOptions = {},
): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatter = options.compact ? usdCompactFormatter : usdFormatter;
  const formatted = formatter.format(Math.abs(safe));
  if (options.showSign && safe > 0) return `+${formatted}`;
  if (safe < 0) return `-${formatted}`;
  return formatted;
}

/**
 * Convert a USD amount to PLN and format it. Returns null when no usable
 * rate is available so callers can fall back to USD-only display.
 */
export function formatPln(
  amount: number,
  rate: number | null | undefined,
  options: CurrencyFormatOptions = {},
): string | null {
  if (!isUsableRate(rate)) return null;
  const safe = Number.isFinite(amount) ? amount : 0;
  const converted = safe * rate;
  const formatter = options.compact ? plnCompactFormatter : plnFormatter;
  const formatted = formatter.format(Math.abs(converted));
  if (options.showSign && converted > 0) return `+${formatted}`;
  if (converted < 0) return `-${formatted}`;
  return formatted;
}

/**
 * Format a USD amount as the primary value plus its optional PLN equivalent.
 * The PLN string is null when no usable rate is available.
 */
export function formatMoney(
  amount: number,
  rate: number | null | undefined,
  options: CurrencyFormatOptions = {},
): FormattedMoney {
  return {
    usd: formatUsd(amount, options),
    pln: formatPln(amount, rate, options),
  };
}
