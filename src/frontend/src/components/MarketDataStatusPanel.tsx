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
  useGetExchangeRate,
  useGetIsAdmin,
  useGetLastFetchError,
  useRefreshAllPrices,
} from "@/hooks/useQueries";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";

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
    lastUpdatedUnknown: "Nieznana",
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
    refreshPricesErrorMarketData: "Nie udało się odświeżyć danych rynkowych",
    refreshPricesErrorPriorityAssets:
      "Nie udało się odświeżyć cen aktywów priorytetowych",
    refreshPricesErrorBoth:
      "Nie udało się odświeżyć danych rynkowych ani cen aktywów priorytetowych",
    refreshPricesErrorDetail: "Szczegóły błędu",
    refreshPricesSuccess: "Ceny zaktualizowane",
    addTokenButton: "Dodaj token",
    adminCheckError: "Nie udało się sprawdzić uprawnień administratora.",
    adminCheckRetry: "Spróbuj ponownie",
    exchangeRateError: "Błąd kursu USD/PLN",
    exchangeRateErrorDetail: "Szczegóły błędu",
  },
  en: {
    marketDataStatus: "Market Data Status",
    loading: "Loading",
    connected: "Connected",
    lastUpdated: "Last updated",
    lastUpdatedUnknown: "Unknown",
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
    refreshPricesErrorMarketData: "Failed to refresh market data",
    refreshPricesErrorPriorityAssets: "Failed to refresh priority asset prices",
    refreshPricesErrorBoth:
      "Failed to refresh both market data and priority asset prices",
    refreshPricesErrorDetail: "Error details",
    refreshPricesSuccess: "Prices updated",
    addTokenButton: "Add token",
    adminCheckError: "Could not verify administrator permissions.",
    adminCheckRetry: "Try again",
    exchangeRateError: "USD/PLN rate error",
    exchangeRateErrorDetail: "Error details",
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
  const [debugOpen, setDebugOpen] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [addTokenOpen, setAddTokenOpen] = useState(false);

  const lastFetchErrorQuery = useGetLastFetchError();
  const isAdminQuery = useGetIsAdmin();
  const exchangeRateQuery = useGetExchangeRate();
  // Fail closed: only treat the caller as admin once the query has resolved
  // successfully with `true`. While loading or on error, hide admin controls.
  // A failed check is retried by the query and can be retried manually below,
  // so a transient error never permanently hides the controls.
  const showDebug = isAdminQuery.isSuccess && isAdminQuery.data === true;
  const adminCheckFailed = isAdminQuery.isError;

  const refreshAllPricesMutation = useRefreshAllPrices();

  const isRefreshing = refreshAllPricesMutation.isPending;

  const handleAdminCheckRetry = () => {
    setRefreshError(null);
    setRefreshSuccess(false);
    void isAdminQuery.refetch();
  };

  const handleRefreshPrices = async () => {
    setRefreshError(null);
    setRefreshSuccess(false);
    try {
      const result = await refreshAllPricesMutation.mutateAsync();
      // The backend never traps; inspect the per-part result instead.
      if (result.marketDataOk && result.priorityAssetsOk) {
        setRefreshSuccess(true);
        return;
      }

      const failedParts: string[] = [];
      if (!result.marketDataOk) {
        failedParts.push(
          `${t.refreshPricesErrorMarketData}${
            result.marketDataError ? `: ${result.marketDataError}` : ""
          }`,
        );
      }
      if (!result.priorityAssetsOk) {
        failedParts.push(
          `${t.refreshPricesErrorPriorityAssets}${
            result.priorityAssetsError ? `: ${result.priorityAssetsError}` : ""
          }`,
        );
      }
      setRefreshError(failedParts.join(" · "));
    } catch (error) {
      console.error("Error refreshing prices:", error);
      const message = error instanceof Error ? error.message : String(error);
      setRefreshError(`${t.refreshPricesError}: ${message}`);
    }
  };

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
                {lastUpdated ? formatTime(lastUpdated) : t.lastUpdatedUnknown}
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

            {/* Refresh prices is available to every signed-in user — no
                admin gate. The backend accepts any authenticated caller. */}
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
                {showDebug && (
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
                )}
              </div>
              {refreshError && (
                <span
                  className="text-xs text-terminal-red"
                  data-ocid="market_data_status.refresh_prices_error"
                >
                  {refreshError}
                </span>
              )}
              {refreshSuccess && (
                <span
                  className="text-xs text-terminal-green"
                  data-ocid="market_data_status.refresh_prices_success"
                >
                  {t.refreshPricesSuccess}
                </span>
              )}
              {exchangeRateQuery.data?.lastError && (
                <span
                  className="flex items-start gap-1.5 text-xs text-terminal-red"
                  data-ocid="market_data_status.exchange_rate_error"
                >
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <span className="font-semibold">
                      {t.exchangeRateError}:
                    </span>{" "}
                    {exchangeRateQuery.data.lastError}
                  </span>
                </span>
              )}
            </div>

            {adminCheckFailed && (
              <div
                className="flex flex-col gap-1"
                data-ocid="market_data_status.admin_check_error"
              >
                <span className="flex items-center gap-1.5 text-xs text-terminal-red">
                  <TriangleAlert className="h-3.5 w-3.5" />
                  {t.adminCheckError}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAdminCheckRetry}
                  disabled={isAdminQuery.isFetching}
                  className="w-fit rounded-terminal font-terminal"
                  data-ocid="market_data_status.admin_check_retry_button"
                >
                  {isAdminQuery.isFetching ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {t.adminCheckRetry}
                </Button>
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
