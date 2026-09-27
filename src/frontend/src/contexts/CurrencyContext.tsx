import type React from "react";
import { createContext, useContext, useMemo } from "react";
import {
  type CurrencyFormatOptions,
  FALLBACK_USD_TO_PLN_RATE,
  type FormattedMoney,
  formatMoney,
  formatPln,
  formatUsd,
} from "../lib/currency";

/**
 * USD -> PLN rate source. The backend query hook that supplies the live rate
 * is added in a later wave; until then the provider accepts the rate as a
 * prop and falls back safely when it is unavailable.
 */
export interface CurrencyContextValue {
  /** Current USD -> PLN rate, or null when unavailable. */
  usdToPlnRate: number | null;
  /** True when a usable rate is available for PLN conversion. */
  hasRate: boolean;
  /** Format a USD amount as the primary USD string. */
  formatUsd: (amount: number, options?: CurrencyFormatOptions) => string;
  /** Format the PLN equivalent, or null when no rate is available. */
  formatPln: (amount: number, options?: CurrencyFormatOptions) => string | null;
  /** Format a USD amount plus its optional PLN equivalent. */
  formatMoney: (
    amount: number,
    options?: CurrencyFormatOptions,
  ) => FormattedMoney;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(
  undefined,
);

interface CurrencyProviderProps {
  children: React.ReactNode;
  /**
   * USD -> PLN rate. Pass null/undefined while the backend rate is loading or
   * unavailable; the provider then shows USD only and never crashes.
   */
  usdToPlnRate?: number | null;
}

export function CurrencyProvider({
  children,
  usdToPlnRate = null,
}: CurrencyProviderProps) {
  const value = useMemo<CurrencyContextValue>(() => {
    const rate =
      typeof usdToPlnRate === "number" &&
      Number.isFinite(usdToPlnRate) &&
      usdToPlnRate > 0
        ? usdToPlnRate
        : null;

    return {
      usdToPlnRate: rate,
      hasRate: rate !== null,
      formatUsd: (amount, options) => formatUsd(amount, options),
      formatPln: (amount, options) => formatPln(amount, rate, options),
      formatMoney: (amount, options) => formatMoney(amount, rate, options),
    };
  }, [usdToPlnRate]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}

export { FALLBACK_USD_TO_PLN_RATE };
