import AddTokenDialog from "@/components/AddTokenDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  useFetchMarketData,
  useFetchPriorityAssetPrices,
  useGetIsAdmin,
  useGetLastFetchError,
} from "@/hooks/useQueries";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
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
    debugTitle: "Debug: ostatni błąd pobierania",
    debugOpen: "Pokaż",
    debugNoError: "Brak błędu — ostatnie odświeżanie zakończone sukcesem.",
    debugErrorLabel: "Błąd:",
    debugTimestampLabel: "Czas błędu:",
    debugLoading: "Ładowanie danych debugowania...",
    debugBlockMarketData: "Dane rynkowe (top 250 monet)",
    debugBlockPriorityAssets: "Priorytetowe aktywa ICP",
    debugBlockTechnicalData: "Dane techniczne",
    refreshPrices: "Odśwież ceny",
    refreshPricesLoading: "Odświeżanie...",
    refreshPricesError: "Błąd odświeżania cen",
    addTokenButton: "Dodaj token",
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
    refreshPrices: "Refresh prices",
    refreshPricesLoading: "Refreshing...",
    refreshPricesError: "Error refreshing prices",
    addTokenButton: "Add token",
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
  const [debugOpen, setDebugOpen] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [addTokenOpen, setAddTokenOpen] = useState(false);

  const lastFetchErrorQuery = useGetLastFetchError();
  const showDebug = useGetIsAdmin();

  const fetchMarketDataMutation = useFetchMarketData();
  const fetchPriorityAssetPricesMutation = useFetchPriorityAssetPrices();

  const isRefreshing =
    fetchMarketDataMutation.isPending ||
    fetchPriorityAssetPricesMutation.isPending;

  const handleRefreshPrices = async () => {
    setRefreshError(false);
    try {
      await Promise.all([
        fetchMarketDataMutation.mutateAsync(),
        fetchPriorityAssetPricesMutation.mutateAsync(),
      ]);
    } catch (error) {
      console.error("Error refreshing prices:", error);
      setRefreshError(true);
    }
  };

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
        <p className="text-sm font-semibold text-terminal">{label}</p>
        {field === null ? (
          <p className="text-sm text-terminal-muted">{t.debugNoError}</p>
        ) : (
          <>
            <p className="text-sm text-terminal-muted">
              <span className="font-semibold text-terminal">
                {t.debugErrorLabel}
              </span>{" "}
              {field.error}
            </p>
            <p className="text-sm text-terminal-muted">
              <span className="font-semibold text-terminal">
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
      return <p className="text-sm text-terminal-muted">{t.debugLoading}</p>;
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
    <Card className="mb-6 rounded-terminal border-terminal bg-terminal-card">
      <div className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left section: Status and timestamp */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-terminal">
                {t.marketDataStatus}
              </span>
              <Badge
                variant="outline"
                className={`flex items-center gap-2 rounded-terminal px-3 py-1 font-terminal ${
                  isLoading
                    ? "bg-terminal-red/10 text-terminal-red border-terminal-red/20"
                    : "bg-terminal-green/10 text-terminal-green border-terminal-green/20"
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
              <span className="text-sm text-terminal-muted">
                {t.lastUpdated}:
              </span>
              <span className="text-sm font-terminal font-semibold text-terminal">
                {lastUpdated
                  ? formatTime(lastUpdated)
                  : formatTime(currentTime)}
              </span>
            </div>
          </div>

          {/* Right section: Calculation quality and tracked assets */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-3">
              <Activity className="h-4 w-4 text-terminal-muted" />
              <span className="text-sm text-terminal-muted">
                {t.calculationQuality}:
              </span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 overflow-hidden rounded-terminal bg-terminal-hover">
                  <div
                    className="h-full bg-terminal-green transition-all duration-300"
                    style={{ width: `${calculationQuality}%` }}
                  />
                </div>
                <span className="text-sm font-terminal font-semibold text-terminal">
                  {calculationQuality}%
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-terminal-muted">
                {t.trackedAssets}:
              </span>
              <Badge
                variant="secondary"
                className="rounded-terminal font-terminal font-semibold"
              >
                {trackedAssetsCount}
              </Badge>
            </div>

            {showDebug && (
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshPrices}
                    disabled={isRefreshing}
                    className="rounded-terminal font-terminal"
                    data-ocid="market_data_status.refresh_prices_button"
                  >
                    {isRefreshing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {t.refreshPricesLoading}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" />
                        {t.refreshPrices}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddTokenOpen(true)}
                    disabled={isRefreshing}
                    className="rounded-terminal font-terminal"
                    data-ocid="market_data_status.add_token_button"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t.addTokenButton}
                  </Button>
                </div>
                {refreshError && (
                  <span
                    className="text-xs text-terminal-red"
                    data-ocid="market_data_status.refresh_prices_error"
                  >
                    {t.refreshPricesError}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {showDebug && (
          <Collapsible
            open={debugOpen}
            onOpenChange={setDebugOpen}
            className="mt-4 border-t border-terminal pt-3"
            data-ocid="market_data_status.debug_section"
          >
            <CollapsibleTrigger
              className="flex items-center gap-1 text-sm font-medium text-terminal-muted hover:text-terminal"
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

      <AddTokenDialog
        isOpen={addTokenOpen}
        onOpenChange={setAddTokenOpen}
        language={language}
      />
    </Card>
  );
}
