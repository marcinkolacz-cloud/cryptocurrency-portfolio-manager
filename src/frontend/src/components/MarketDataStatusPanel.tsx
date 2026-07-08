import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  useAddCustomPriorityAsset,
  useFetchMarketData,
  useFetchPriorityAssetPrices,
  useGetCustomPriorityAssets,
  useGetIsAdmin,
  useGetLastFetchError,
  useSearchCoinGeckoTokens,
} from "@/hooks/useQueries";
import type { CoinGeckoSearchResult } from "@/hooks/useQueries";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
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
    refreshPrices: "Odśwież ceny",
    refreshPricesLoading: "Odświeżanie...",
    refreshPricesError: "Błąd odświeżania cen",
    addPriorityAssetTitle: "Dodaj priorytetowe aktywa",
    searchPlaceholder: "Szukaj monety (np. bitcoin, eth, solana)",
    searchButton: "Szukaj",
    searching: "Szukanie...",
    noResults: "Brak wyników",
    searchError: "Błąd wyszukiwania",
    addButton: "Dodaj",
    adding: "Dodawanie...",
    added: "Dodano {symbol}",
    addError: "Błąd dodawania",
    customAssetsTitle: "Dodane priorytetowe aktywa",
    noCustomAssets: "Brak dodanych aktywów",
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
    addPriorityAssetTitle: "Add Priority Asset",
    searchPlaceholder: "Search coin (e.g. bitcoin, eth, solana)",
    searchButton: "Search",
    searching: "Searching...",
    noResults: "No results",
    searchError: "Search error",
    addButton: "Add",
    adding: "Adding...",
    added: "Added {symbol}",
    addError: "Error adding",
    customAssetsTitle: "Added custom assets",
    noCustomAssets: "No custom assets added",
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
  const [refreshError, setRefreshError] = useState(false);

  const lastFetchErrorQuery = useGetLastFetchError();
  const isAdminQuery = useGetIsAdmin();
  const showDebug = isAdmin || isAdminQuery;

  const fetchMarketDataMutation = useFetchMarketData();
  const fetchPriorityAssetPricesMutation = useFetchPriorityAssetPrices();

  // Admin: add priority asset panel state + hooks
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CoinGeckoSearchResult[]>(
    [],
  );
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addFeedback, setAddFeedback] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);

  const searchTokensMutation = useSearchCoinGeckoTokens();
  const addAssetMutation = useAddCustomPriorityAsset();
  const customAssetsQuery = useGetCustomPriorityAssets();

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

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    // Clear previous results + feedback when a new search starts
    setSearchResults([]);
    setSearchError(null);
    setAddFeedback(null);
    try {
      const response = await searchTokensMutation.mutateAsync(query);
      if (response.error) {
        setSearchError(response.error);
        setSearchResults([]);
      } else {
        setSearchResults(response.results.slice(0, 10));
      }
    } catch (error) {
      console.error("Error searching CoinGecko tokens:", error);
      setSearchError(error instanceof Error ? error.message : t.searchError);
      setSearchResults([]);
    }
  };

  const handleAdd = async (coin: CoinGeckoSearchResult) => {
    setAddFeedback(null);
    try {
      const ticker = coin.symbol.toUpperCase();
      const response = await addAssetMutation.mutateAsync({
        coinGeckoId: coin.id,
        tickerSymbol: ticker,
      });
      if (response.success) {
        setAddFeedback({
          message: t.added.replace("{symbol}", ticker),
          isError: false,
        });
        // Refetch custom priority assets + clear search results
        await customAssetsQuery.refetch();
        setSearchResults([]);
        setSearchQuery("");
      } else {
        setAddFeedback({
          message: response.error || t.addError,
          isError: true,
        });
      }
    } catch (error) {
      console.error("Error adding custom priority asset:", error);
      setAddFeedback({
        message: error instanceof Error ? error.message : t.addError,
        isError: true,
      });
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setAddFeedback(null);
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

        {showDebug && (
          <div
            className="mt-4 border-t border-terminal pt-3"
            data-ocid="market_data_status.add_priority_asset.section"
          >
            <p className="mb-2 text-sm font-semibold text-terminal">
              {t.addPriorityAssetTitle}
            </p>

            {/* Search row */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder={t.searchPlaceholder}
                disabled={searchTokensMutation.isPending}
                className="rounded-terminal border-terminal bg-terminal-hover font-terminal text-terminal placeholder:text-terminal-muted focus-visible:ring-terminal-green/40"
                data-ocid="market_data_status.add_priority_asset.search_input"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSearch}
                  disabled={
                    searchTokensMutation.isPending || !searchQuery.trim()
                  }
                  className="rounded-terminal font-terminal"
                  data-ocid="market_data_status.add_priority_asset.search_button"
                >
                  {searchTokensMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t.searching}
                    </>
                  ) : (
                    <>
                      <Search className="h-3.5 w-3.5" />
                      {t.searchButton}
                    </>
                  )}
                </Button>
                {(searchResults.length > 0 || searchQuery || searchError) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSearch}
                    disabled={searchTokensMutation.isPending}
                    className="rounded-terminal font-terminal"
                    data-ocid="market_data_status.add_priority_asset.clear_button"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Search error */}
            {searchError && (
              <p
                className="mt-2 text-xs text-terminal-red"
                data-ocid="market_data_status.add_priority_asset.search_error"
              >
                {searchError}
              </p>
            )}

            {/* Results list */}
            {searchTokensMutation.isPending && searchResults.length === 0 && (
              <p
                className="mt-2 text-xs text-terminal-muted"
                data-ocid="market_data_status.add_priority_asset.searching_state"
              >
                {t.searching}
              </p>
            )}

            {!searchTokensMutation.isPending &&
              !searchError &&
              searchResults.length === 0 &&
              searchQuery && (
                <p
                  className="mt-2 text-xs text-terminal-muted"
                  data-ocid="market_data_status.add_priority_asset.empty_state"
                >
                  {t.noResults}
                </p>
              )}

            {searchResults.length > 0 && (
              <ul
                className="mt-2 flex flex-col gap-1"
                data-ocid="market_data_status.add_priority_asset.results_list"
              >
                {searchResults.map((coin, index) => (
                  <li
                    key={coin.id}
                    className="flex items-center justify-between gap-2 rounded-terminal bg-terminal-hover px-2 py-1.5"
                    data-ocid={`market_data_status.add_priority_asset.item.${index + 1}`}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-terminal text-terminal">
                        {coin.name}
                      </span>
                      <span className="truncate text-xs text-terminal-muted">
                        {coin.symbol.toUpperCase()} · {coin.id}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAdd(coin)}
                      disabled={
                        addAssetMutation.isPending ||
                        addAssetMutation.variables?.coinGeckoId === coin.id
                      }
                      className="shrink-0 rounded-terminal font-terminal"
                      data-ocid={`market_data_status.add_priority_asset.add_button.${index + 1}`}
                    >
                      {addAssetMutation.isPending &&
                      addAssetMutation.variables?.coinGeckoId === coin.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {t.adding}
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          {t.addButton}
                        </>
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add feedback */}
            {addFeedback && (
              <p
                className={`mt-2 text-xs ${
                  addFeedback.isError
                    ? "text-terminal-red"
                    : "text-terminal-green"
                }`}
                data-ocid={
                  addFeedback.isError
                    ? "market_data_status.add_priority_asset.add_error_state"
                    : "market_data_status.add_priority_asset.add_success_state"
                }
              >
                {addFeedback.message}
              </p>
            )}

            {/* Currently-added custom priority assets */}
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-semibold text-terminal-muted">
                {t.customAssetsTitle}
              </p>
              {customAssetsQuery.isLoading ? (
                <p
                  className="text-xs text-terminal-muted"
                  data-ocid="market_data_status.add_priority_asset.custom_loading_state"
                >
                  {t.debugLoading}
                </p>
              ) : customAssetsQuery.data &&
                customAssetsQuery.data.length > 0 ? (
                <div
                  className="flex flex-wrap gap-1.5"
                  data-ocid="market_data_status.add_priority_asset.custom_assets_list"
                >
                  {customAssetsQuery.data.map(([assetId, ticker], index) => (
                    <Badge
                      key={`${assetId}-${ticker}`}
                      variant="outline"
                      className="rounded-terminal bg-terminal-green/10 font-terminal text-terminal-green border-terminal-green/20"
                      data-ocid={`market_data_status.add_priority_asset.custom_asset.item.${index + 1}`}
                    >
                      {assetId} ({ticker})
                    </Badge>
                  ))}
                </div>
              ) : (
                <p
                  className="text-xs text-terminal-muted"
                  data-ocid="market_data_status.add_priority_asset.custom_empty_state"
                >
                  {t.noCustomAssets}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
