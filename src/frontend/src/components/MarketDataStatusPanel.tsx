import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useGetIsAdmin, useGetLastFetchError } from "@/hooks/useQueries";
import { Activity, CheckCircle2, ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface MarketDataStatusPanelProps {
  language: "pl" | "en";
  isLoading: boolean;
  trackedAssetsCount: number;
  lastUpdated: Date | null;
  calculationQuality: number;
  isAdmin?: boolean;
}

const translations = {
  pl: {
    marketDataStatus: "Status danych rynkowych",
    loading: "Ładowanie",
    connected: "Połączono",
    lastUpdated: "Ostatnia aktualizacja",
    calculationQuality: "Jakość obliczeń",
    trackedAssets: "Śledzone aktywa",
    debugTitle: "Debug: ostatni błąd pobierania",
    debugOpen: "Pokaż",
    debugNoError: "Brak błędu — ostatnie odświeżanie zakończone sukcesem.",
    debugErrorLabel: "Błąd:",
    debugTimestampLabel: "Czas błędu:",
    debugLoading: "Ładowanie danych debugowania...",
    debugBlockMarketData: "Dane rynkowe (top 250 monet)",
    debugBlockPriorityAssets: "Priorytetowe aktywa ICP",
    debugBlockTechnicalData: "Dane techniczne",
  },
  en: {
    marketDataStatus: "Market Data Status",
    loading: "Loading",
    connected: "Connected",
    lastUpdated: "Last updated",
    calculationQuality: "Calculation Quality",
    trackedAssets: "Tracked Assets",
    debugTitle: "Debug: last fetch error",
    debugOpen: "Show",
    debugNoError: "No error — last refresh succeeded.",
    debugErrorLabel: "Error:",
    debugTimestampLabel: "Error time:",
    debugLoading: "Loading debug data...",
    debugBlockMarketData: "Market data (top 250 coins)",
    debugBlockPriorityAssets: "Priority ICP assets",
    debugBlockTechnicalData: "Technical data",
  },
};

export default function MarketDataStatusPanel({
  language,
  isLoading,
  trackedAssetsCount,
  lastUpdated,
  calculationQuality,
  isAdmin = false,
}: MarketDataStatusPanelProps) {
  const t = translations[language];
  const [currentTime, setCurrentTime] = useState(new Date());
  const [debugOpen, setDebugOpen] = useState(false);

  const lastFetchErrorQuery = useGetLastFetchError();
  const isAdminQuery = useGetIsAdmin();
  const showDebug = isAdmin || isAdminQuery;

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

  const formatDateTime = (date: Date) => {
    return date.toLocaleString(language === "pl" ? "pl-PL" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const renderErrorBlock = (
    label: string,
    field: { error: string; timestamp: bigint } | null,
  ) => {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {field === null ? (
          <p className="text-sm text-muted-foreground">{t.debugNoError}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {t.debugErrorLabel}
              </span>{" "}
              {field.error}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {t.debugTimestampLabel}
              </span>{" "}
              {formatDateTime(new Date(Number(field.timestamp) / 1_000_000))}
            </p>
          </>
        )}
      </div>
    );
  };

  const renderDebugContent = () => {
    if (lastFetchErrorQuery.isLoading) {
      return <p className="text-sm text-muted-foreground">{t.debugLoading}</p>;
    }

    const data = lastFetchErrorQuery.data ?? {
      marketData: null,
      priorityAssets: null,
      technicalData: null,
    };

    return (
      <div className="flex flex-col gap-3">
        {renderErrorBlock(t.debugBlockMarketData, data.marketData)}
        {renderErrorBlock(t.debugBlockPriorityAssets, data.priorityAssets)}
        {renderErrorBlock(t.debugBlockTechnicalData, data.technicalData)}
      </div>
    );
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

        {showDebug && (
          <Collapsible
            open={debugOpen}
            onOpenChange={setDebugOpen}
            className="mt-4 border-t pt-3"
            data-ocid="market_data_status.debug_section"
          >
            <CollapsibleTrigger
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
              data-ocid="market_data_status.debug_toggle"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  debugOpen ? "rotate-180" : ""
                }`}
              />
              {t.debugTitle}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              {renderDebugContent()}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </Card>
  );
}
