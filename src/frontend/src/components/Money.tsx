import { cn } from "@/lib/utils";
import { useCurrency } from "../contexts/CurrencyContext";
import type { CurrencyFormatOptions } from "../lib/currency";

interface MoneyProps {
  /** Amount in USD (the primary display currency). */
  usd: number;
  /** Round to whole units for compact contexts such as chart axes. */
  compact?: boolean;
  /** Prefix a sign for positive values (used by P&L figures). */
  showSign?: boolean;
  /** Extra classes applied to the primary USD value. */
  className?: string;
  /** Extra classes applied to the secondary PLN value. */
  secondaryClassName?: string;
}

/**
 * Renders a USD amount as the primary value with its PLN equivalent
 * automatically beneath it. When no exchange rate is available the PLN line
 * is omitted and only the USD value is shown.
 */
export function Money({
  usd,
  compact = false,
  showSign = false,
  className,
  secondaryClassName,
}: MoneyProps) {
  const { formatMoney } = useCurrency();
  const options: CurrencyFormatOptions = { compact, showSign };
  const { usd: usdText, pln: plnText } = formatMoney(usd, options);

  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className={cn("font-terminal tabular-nums", className)}>
        {usdText}
      </span>
      {plnText ? (
        <span
          className={cn(
            "font-terminal text-[0.7em] tabular-nums text-terminal-muted",
            secondaryClassName,
          )}
        >
          {plnText}
        </span>
      ) : null}
    </span>
  );
}
