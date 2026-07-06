import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Activity, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface MarketDataStatusPanelProps {
  language: "pl" | "en";
  isLoading: boolean;
  trackedAssetsCount: number;
  lastUpdated: Date | null;
  calculationQuality: number;
}

const translations = {
  pl: {
    marketDataStatus: "Status danych rynkowych",
    loading: "Ładowanie",
    connected: "Połączono",
    lastUpdated: "Ostatnia aktualizacja",
    calculationQuality: "Jakość obliczeń",
    trackedAssets: "Śledzone aktywa",
  },
  en: {
    marketDataStatus: "Market Data Status",
    loading: "Loading",
    connected: "Connected",
    lastUpdated: "Last updated",
    calculationQuality: "Calculation Quality",
    trackedAssets: "Tracked Assets",
  },
};

export default function MarketDataStatusPanel({
  language,
  isLoading,
  trackedAssetsCount,
  lastUpdated,
  calculationQuality,
}: MarketDataStatusPanelProps) {
  const t = translations[language];
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(language === "pl" ? "pl-PL" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <Card className="mb-6 border-2">
      <div className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left section: Status and timestamp */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">
                {t.marketDataStatus}
              </span>
              <Badge
                variant="outline"
                className={`flex items-center gap-2 px-3 py-1 ${
                  isLoading
                    ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                    : "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="font-semibold uppercase tracking-wide">
                      {t.loading}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="font-semibold uppercase tracking-wide">
                      {t.connected}
                    </span>
                  </>
                )}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {t.lastUpdated}:
              </span>
              <span className="text-sm font-mono font-semibold text-foreground">
                {lastUpdated
                  ? formatTime(lastUpdated)
                  : formatTime(currentTime)}
              </span>
            </div>
          </div>

          {/* Right section: Calculation quality and tracked assets */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-3">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {t.calculationQuality}:
              </span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${calculationQuality}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {calculationQuality}%
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {t.trackedAssets}:
              </span>
              <Badge variant="secondary" className="font-semibold">
                {trackedAssetsCount}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
