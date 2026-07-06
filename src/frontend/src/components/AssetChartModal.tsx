import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BarChart2, Loader2, TrendingDown, TrendingUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetchCoinTechnicalData } from "../hooks/useQueries";

interface AssetChartModalProps {
  coinId: string;
  symbol: string;
  name: string;
  language: "pl" | "en";
  open: boolean;
  onClose: () => void;
}

// ICP ecosystem tokens that have no TradingView chart
const ICP_NO_CHART_COIN_IDS = new Set([
  "folks",
  "waterneuron",
  "rujira",
  "gold-dao",
  "openchat",
  "icpswap-token",
  "iclighthouse-dao",
  "origyn-foundation",
  "sonic-2",
]);

// Explicit coinId → TradingView symbol map
const TV_SYMBOL_MAP: Record<string, string> = {
  bitcoin: "BINANCE:BTCUSDT",
  ethereum: "BINANCE:ETHUSDT",
  "internet-computer": "BINANCE:ICPUSDT",
  binancecoin: "BINANCE:BNBUSDT",
  cardano: "BINANCE:ADAUSDT",
  solana: "BINANCE:SOLUSDT",
  ripple: "BINANCE:XRPUSDT",
  dogecoin: "BINANCE:DOGEUSDT",
  polkadot: "BINANCE:DOTUSDT",
  chainlink: "BINANCE:LINKUSDT",
  near: "BINANCE:NEARUSDT",
  cosmos: "BINANCE:ATOMUSDT",
  osmosis: "BINANCE:OSMOUSDT",
  algorand: "BINANCE:ALGOUSDT",
  tether: "BINANCE:USDTUSDC",
  "usd-coin": "COINBASE:USDCUSD",
  dai: "COINBASE:DAIUSD",
  "pax-gold": "BINANCE:PAXGUSDT",
  celestia: "BINANCE:TIAUSDT",
  archway: "COINBASE:ARCHUSD",
  secret: "BINANCE:SCRTUSDT",
  ergo: "COINBASE:ERGUSD",
  "juno-network": "BINANCE:JUNOUSDT",
  "casper-network": "COINBASE:CSPRUSD",
  evmos: "COINBASE:EVMOSUSD",
  "binance-usd": "BINANCE:BUSDUSDT",
  "paxos-standard": "BINANCE:PAXUSDT",
};

function getTradingViewSymbol(coinId: string, symbol: string): string | null {
  if (ICP_NO_CHART_COIN_IDS.has(coinId)) return null;
  if (TV_SYMBOL_MAP[coinId]) return TV_SYMBOL_MAP[coinId];
  const upper = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (upper) return `BINANCE:${upper}USDT`;
  return null;
}

function buildWidgetUrl(tvSymbol: string, isDark: boolean): string {
  const params = new URLSearchParams({
    frameElementId: "tradingview_chart",
    symbol: tvSymbol,
    interval: "D",
    hidesidetoolbar: "0",
    hidetoptoolbar: "0",
    symboledit: "1",
    saveimage: "1",
    toolbarbg: isDark ? "1a1a2e" : "f1f3f6",
    studies: "[]",
    theme: isDark ? "dark" : "light",
    style: "1",
    timezone: "Etc/UTC",
    withdateranges: "1",
    showpopupbutton: "1",
    locale: "en",
    allow_symbol_change: "1",
    save_image: "1",
  });
  return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
}

const translations = {
  pl: {
    priceChart: "Wykres ceny",
    technicalData: "Dane techniczne",
    currentPrice: "Aktualna cena",
    marketCap: "Kapitalizacja rynkowa",
    change24h: "Zmiana 24h",
    volume24h: "Wolumen 24h",
    loadingTechnicalData: "Ładowanie danych technicznych...",
    noChart: "Wykres niedostępny dla tego aktywa na TradingView",
    noChartSub: "Dane cenowe są dostępne w tabeli aktywów powyżej.",
  },
  en: {
    priceChart: "Price chart",
    technicalData: "Technical Data",
    currentPrice: "Current Price",
    marketCap: "Market Cap",
    change24h: "24h Change",
    volume24h: "24h Volume",
    loadingTechnicalData: "Loading technical data...",
    noChart: "Chart not available for this asset on TradingView",
    noChartSub: "Price data is available in the assets table above.",
  },
};

export default function AssetChartModal({
  coinId,
  symbol,
  name,
  language,
  open,
  onClose,
}: AssetChartModalProps) {
  const { data: technicalData, isLoading: isTechnicalLoading } =
    useFetchCoinTechnicalData(coinId);
  const t = translations[language];

  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const tvSymbol = getTradingViewSymbol(coinId, symbol);
  const widgetUrl = tvSymbol ? buildWidgetUrl(tvSymbol, isDark) : null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(language === "pl" ? "pl-PL" : "en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value);

  const formatLargeNumber = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return formatCurrency(value);
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-5xl max-h-[95vh] overflow-y-auto"
        data-ocid="asset_chart.dialog"
      >
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <DialogTitle className="text-2xl font-bold">
              {symbol} — {name}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">{t.priceChart}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-ocid="asset_chart.close_button"
          >
            <X className="h-5 w-5" />
          </Button>
        </DialogHeader>

        {/* Technical Data Section */}
        <div className="w-full mb-6">
          <h3 className="text-lg font-semibold mb-4">{t.technicalData}</h3>
          {isTechnicalLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {t.loadingTechnicalData}
                </p>
              </div>
            </div>
          ) : technicalData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                <p className="text-sm text-muted-foreground mb-1">
                  {t.currentPrice}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(technicalData.currentPrice)}
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                <p className="text-sm text-muted-foreground mb-1">
                  {t.marketCap}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatLargeNumber(technicalData.marketCap)}
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                <p className="text-sm text-muted-foreground mb-1">
                  {t.change24h}
                </p>
                <div className="flex items-center gap-2">
                  {technicalData.change24h >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  )}
                  <p
                    className={`text-2xl font-bold ${
                      technicalData.change24h >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {formatPercentage(technicalData.change24h)}
                  </p>
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                <p className="text-sm text-muted-foreground mb-1">
                  {t.volume24h}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatLargeNumber(technicalData.volume24h)}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-card border border-border rounded-lg p-4 shadow-sm"
                >
                  <div className="h-4 bg-muted rounded mb-2 animate-pulse" />
                  <div className="h-8 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TradingView Chart or Fallback */}
        <div className="w-full">
          {widgetUrl ? (
            <div
              className="w-full rounded-lg overflow-hidden border border-border"
              style={{ height: 520 }}
              data-ocid="asset_chart.canvas_target"
            >
              <iframe
                key={`${tvSymbol}-${isDark}`}
                src={widgetUrl}
                title={`TradingView chart for ${symbol}`}
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-muted/30 py-16 px-8"
              data-ocid="asset_chart.empty_state"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <BarChart2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-foreground">
                  {t.noChart}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.noChartSub}
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
