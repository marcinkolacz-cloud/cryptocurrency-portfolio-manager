import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Asset,
  ExchangeRate,
  MarketData,
  Portfolio,
  PriorityAsset,
  RefreshResult,
  Transaction,
  UserProfile,
} from "../backend";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

const MAX_QUERY_RETRIES = 3;
const RETRY_DELAY_BASE = 1500;

/**
 * Stable identity key for the signed-in principal. Used to scope
 * identity-dependent queries so a value cached for a previous session can
 * never leak into the next one. Returns null while no identity is available.
 */
function useCallerPrincipalKey(): string | null {
  const { identity } = useInternetIdentity();
  if (!identity) return null;
  try {
    return identity.getPrincipal().toText();
  } catch {
    return null;
  }
}

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      if (!actor) {
        console.error("Actor not available for profile query");
        throw new Error(
          "Backend connection not available. Please wait or try again.",
        );
      }

      console.log("Fetching user profile...");
      try {
        const profile = await actor.getCallerUserProfile();
        console.log(
          "User profile fetched:",
          profile ? "Profile exists" : "No profile (new user)",
        );
        return profile;
      } catch (error) {
        console.error("Error fetching user profile:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Error details:", {
          message: errorMessage,
          type: typeof error,
          error,
        });

        // Re-throw with more context
        if (
          errorMessage.includes("Unauthorized") ||
          errorMessage.includes("permission")
        ) {
          throw new Error(`Authorization error: ${errorMessage}`);
        }
        if (
          errorMessage.includes("Actor") ||
          errorMessage.includes("connection")
        ) {
          throw new Error(`Backend connection error: ${errorMessage}`);
        }
        throw error;
      }
    },
    enabled: !!actor && !actorFetching,
    retry: (failureCount, error) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Don't retry authorization errors
      if (
        errorMessage.includes("Unauthorized") ||
        errorMessage.includes("Authorization") ||
        errorMessage.includes("permission")
      ) {
        console.log("Authorization error - not retrying");
        return false;
      }

      // Retry connection errors
      console.log(`Profile query retry ${failureCount}/${MAX_QUERY_RETRIES}`);
      return failureCount < MAX_QUERY_RETRIES;
    },
    retryDelay: (attemptIndex) => {
      const delay = Math.min(RETRY_DELAY_BASE * 2 ** attemptIndex, 8000);
      console.log(`Retrying profile query in ${delay}ms...`);
      return delay;
    },
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && !actorFetching && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error("Backend connection not available");
      console.log("Saving user profile:", profile);
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      console.log("Profile saved successfully");
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
    },
    onError: (error) => {
      console.error("Error saving profile:", error);
    },
  });
}

export function useGetPortfolios() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<Portfolio[]>({
    queryKey: ["portfolios"],
    queryFn: async () => {
      if (!actor) {
        console.error("Actor not available for portfolios query");
        throw new Error("Backend connection not available");
      }

      console.log("Fetching portfolios...");
      try {
        const portfolios = await actor.getPortfolios();
        console.log("Portfolios fetched:", portfolios?.length ?? 0);
        return Array.isArray(portfolios) ? portfolios : [];
      } catch (error) {
        console.error("Error fetching portfolios:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Portfolio error details:", {
          message: errorMessage,
          type: typeof error,
          error,
        });
        throw error;
      }
    },
    enabled: !!actor && !actorFetching,
    retry: (failureCount, error) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("Unauthorized") ||
        errorMessage.includes("permission")
      ) {
        return false;
      }
      return failureCount < MAX_QUERY_RETRIES;
    },
    retryDelay: (attemptIndex) =>
      Math.min(RETRY_DELAY_BASE * 2 ** attemptIndex, 8000),
  });
}

export function useCreatePortfolio() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!actor) throw new Error("Backend connection not available");
      console.log("Creating portfolio:", name);
      return actor.createPortfolio(name);
    },
    onSuccess: () => {
      console.log("Portfolio created successfully");
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
    },
    onError: (error) => {
      console.error("Error creating portfolio:", error);
    },
  });
}

export function useDeletePortfolio() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (portfolioId: bigint) => {
      if (!actor) throw new Error("Backend connection not available");
      console.log("Deleting portfolio:", portfolioId);
      return actor.deletePortfolio(portfolioId);
    },
    onSuccess: () => {
      console.log("Portfolio deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
    },
    onError: (error) => {
      console.error("Error deleting portfolio:", error);
    },
  });
}

export function useAddTransaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      portfolioId,
      transaction,
    }: { portfolioId: bigint; transaction: Transaction }) => {
      if (!actor) throw new Error("Backend connection not available");
      return actor.addTransaction(portfolioId, transaction);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["portfolioTrackedAssets"] });
      queryClient.invalidateQueries({ queryKey: ["marketData"] });
      queryClient.invalidateQueries({ queryKey: ["priorityAssets"] });
    },
    onError: (error) => {
      console.error("Error adding transaction:", error);
    },
  });
}

export function useEditTransaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      portfolioId,
      transactionId,
      transaction,
    }: {
      portfolioId: bigint;
      transactionId: bigint;
      transaction: Transaction;
    }) => {
      if (!actor) throw new Error("Backend connection not available");
      return actor.editTransaction(portfolioId, transactionId, transaction);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["portfolioTrackedAssets"] });
      queryClient.invalidateQueries({ queryKey: ["marketData"] });
      queryClient.invalidateQueries({ queryKey: ["priorityAssets"] });
    },
    onError: (error) => {
      console.error("Error editing transaction:", error);
    },
  });
}

export function useDeleteTransaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      portfolioId,
      transactionId,
    }: { portfolioId: bigint; transactionId: bigint }) => {
      if (!actor) throw new Error("Backend connection not available");
      return actor.deleteTransaction(portfolioId, transactionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["portfolioTrackedAssets"] });
      queryClient.invalidateQueries({ queryKey: ["marketData"] });
      queryClient.invalidateQueries({ queryKey: ["priorityAssets"] });
    },
    onError: (error) => {
      console.error("Error deleting transaction:", error);
    },
  });
}

export function useGetMarketData() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<MarketData[]>({
    queryKey: ["marketData"],
    queryFn: async () => {
      if (!actor) return [];
      try {
        const data = await actor.getMarketData();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching market data:", error);
        return [];
      }
    },
    enabled: !!actor && !actorFetching,
    staleTime: 60000,
  });
}

export function useFetchMarketData() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend connection not available");
      return actor.fetchMarketData();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketData"] });
    },
    onError: (error) => {
      console.error("Error fetching market data:", error);
    },
  });
}

export function useFetchPriorityAssetPrices() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend connection not available");
      return actor.fetchPriorityAssetPrices();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["priorityAssets"] });
    },
    onError: (error) => {
      console.error("Error fetching priority asset prices:", error);
    },
  });
}

/**
 * Single admin-gated refresh that updates both market data and priority
 * asset prices. The backend never traps: it returns a RefreshResult that
 * reports which part succeeded and carries the recorded error text for any
 * part that failed. On success we invalidate every affected query, including
 * ['lastFetchError'] so the debug panel reflects the new state immediately.
 */
export function useRefreshAllPrices() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<RefreshResult, Error, void>({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend connection not available");
      return actor.refreshAllPrices();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketData"] });
      void queryClient.invalidateQueries({ queryKey: ["priorityAssets"] });
      void queryClient.invalidateQueries({ queryKey: ["lastFetchError"] });
      // The refresh action also refreshes the USD->PLN rate on the backend, so
      // refetch it here to keep the displayed PLN equivalents in sync.
      void queryClient.invalidateQueries({ queryKey: ["exchangeRate"] });
    },
    onError: (error) => {
      console.error("Error refreshing all prices:", error);
    },
  });
}

/**
 * Live USD -> PLN exchange rate from the backend.
 *
 * Returns the full ExchangeRate record (rate, lastUpdated, sourceTimestamp,
 * lastError) or null when the backend has no rate yet. A missing rate is a
 * normal state, not an error: the CurrencyProvider then renders USD only.
 * `lastError` is surfaced separately by the status panel.
 */
export function useGetExchangeRate() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<ExchangeRate | null>({
    queryKey: ["exchangeRate"],
    queryFn: async () => {
      if (!actor) return null;
      try {
        const result = await actor.getExchangeRate();
        return result ?? null;
      } catch (error) {
        console.error("Error fetching exchange rate:", error);
        return null;
      }
    },
    enabled: !!actor && !actorFetching,
    staleTime: 60000,
  });
}

/**
 * Admin-gated on-demand refresh of the USD -> PLN rate. Invalidates the
 * exchange-rate query so the displayed PLN values update immediately.
 */
export function useRefreshExchangeRate() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<ExchangeRate, Error, void>({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend connection not available");
      return actor.refreshExchangeRate();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exchangeRate"] });
    },
    onError: (error) => {
      console.error("Error refreshing exchange rate:", error);
    },
  });
}

export function useGetPriorityAssets() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<PriorityAsset[]>({
    queryKey: ["priorityAssets"],
    queryFn: async () => {
      if (!actor) return [];
      try {
        const data = await actor.getPriorityAssets();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching priority assets:", error);
        return [];
      }
    },
    enabled: !!actor && !actorFetching,
    staleTime: 60000,
  });
}

export interface FetchError {
  error: string;
  timestamp: bigint;
}

export interface LastFetchErrors {
  marketData: FetchError | null;
  priorityAssets: FetchError | null;
  technicalData: FetchError | null;
}

const EMPTY_LAST_FETCH_ERRORS: LastFetchErrors = {
  marketData: null,
  priorityAssets: null,
  technicalData: null,
};

export function useGetLastFetchError() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<LastFetchErrors>({
    queryKey: ["lastFetchError"],
    queryFn: async () => {
      if (!actor) return EMPTY_LAST_FETCH_ERRORS;
      try {
        const result = await actor.getLastFetchError();
        return {
          marketData: result.marketData ?? null,
          priorityAssets: result.priorityAssets ?? null,
          technicalData: result.technicalData ?? null,
        };
      } catch (error) {
        console.error("Error fetching last fetch error:", error);
        return EMPTY_LAST_FETCH_ERRORS;
      }
    },
    enabled: !!actor && !actorFetching,
    staleTime: 30000,
  });
}

/**
 * Admin status for the signed-in caller.
 *
 * The query key is scoped to the caller principal so a value cached for a
 * previous session can never hide the admin controls after a login/logout
 * switch. A failed check is surfaced as an error (never cached as `false`)
 * and retried, so a transient failure cannot permanently hide the controls.
 * The backend returns a plain boolean and does not trap for unregistered
 * callers, so a resolved `false` is a real answer.
 */
export function useGetIsAdmin() {
  const { actor, isFetching: actorFetching } = useActor();
  const principalKey = useCallerPrincipalKey();

  return useQuery<boolean>({
    queryKey: ["isAdmin", principalKey],
    queryFn: async () => {
      if (!actor) {
        throw new Error("Backend connection not available");
      }
      const isAdmin = await actor.isCallerAdmin();
      return isAdmin === true;
    },
    enabled: !!actor && !actorFetching && !!principalKey,
    staleTime: 30000,
    retry: (failureCount, error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Unauthorized") || message.includes("permission")) {
        return false;
      }
      return failureCount < MAX_QUERY_RETRIES;
    },
    retryDelay: (attemptIndex) =>
      Math.min(RETRY_DELAY_BASE * 2 ** attemptIndex, 8000),
  });
}

export interface CoinTechnicalData {
  symbol: string;
  name: string;
  currentPrice: number;
  marketCap: number;
  change24h: number;
  volume24h: number;
}

export function useGetPortfolioTrackedAssets(portfolioId: bigint | null) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<string[]>({
    queryKey: ["portfolioTrackedAssets", portfolioId?.toString()],
    queryFn: async () => {
      if (!actor || !portfolioId) return [];
      try {
        const trackedAssets =
          await actor.getPortfolioTrackedAssets(portfolioId);
        console.log("Tracked assets for portfolio:", trackedAssets);
        return Array.isArray(trackedAssets) ? trackedAssets : [];
      } catch (error) {
        console.error("Error fetching tracked assets:", error);
        return [];
      }
    },
    enabled: !!actor && !actorFetching && portfolioId !== null,
    staleTime: 60000,
  });
}

export function useFetchCoinChartData(coinId: string | null) {
  return useQuery<{ prices: [number, number][] }>({
    queryKey: ["coinChartData", coinId],
    queryFn: async () => {
      if (!coinId) throw new Error("No coin ID provided");
      console.log("Fetching chart data for:", coinId);
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=30&interval=daily`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch chart data");
      }
      const data = await response.json();
      console.log("Chart data fetched for:", coinId);
      return data || { prices: [] };
    },
    enabled: !!coinId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: 2000,
  });
}

export function useFetchCoinTechnicalData(coinId: string | null) {
  return useQuery<CoinTechnicalData>({
    queryKey: ["coinTechnicalData", coinId],
    queryFn: async () => {
      if (!coinId) throw new Error("No coin ID provided");
      console.log("Fetching technical data for:", coinId);

      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch technical data");
      }

      const data = await response.json();
      console.log("Technical data fetched for:", coinId);

      return {
        symbol: data.symbol?.toUpperCase() || "",
        name: data.name || "",
        currentPrice: data.market_data?.current_price?.usd || 0,
        marketCap: data.market_data?.market_cap?.usd || 0,
        change24h: data.market_data?.price_change_percentage_24h || 0,
        volume24h: data.market_data?.total_volume?.usd || 0,
      };
    },
    enabled: !!coinId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: 2000,
  });
}

export interface CoinGeckoSearchResult {
  id: string;
  name: string;
  symbol: string;
}

export interface CoinGeckoSearchResponse {
  results: CoinGeckoSearchResult[];
  error?: string;
}

export interface AddCustomPriorityAssetResponse {
  success: boolean;
  error?: string;
}

export function useSearchCoinGeckoTokens() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (
      searchQuery: string,
    ): Promise<CoinGeckoSearchResponse> => {
      if (!actor) throw new Error("Backend connection not available");
      console.log("Searching CoinGecko tokens:", searchQuery);
      const result = await actor.searchCoinGeckoTokens(searchQuery);
      return {
        results: Array.isArray(result?.results) ? result.results : [],
        error: result?.error,
      };
    },
    onError: (error) => {
      console.error("Error searching CoinGecko tokens:", error);
    },
  });
}

export function useAddCustomPriorityAsset() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      coinGeckoId,
      tickerSymbol,
    }: {
      coinGeckoId: string;
      tickerSymbol: string;
    }): Promise<AddCustomPriorityAssetResponse> => {
      if (!actor) throw new Error("Backend connection not available");
      console.log("Adding custom priority asset:", coinGeckoId, tickerSymbol);
      const result = await actor.addCustomPriorityAsset(
        coinGeckoId,
        tickerSymbol,
      );
      return {
        success: result?.success === true,
        error: result?.error,
      };
    },
    onSuccess: () => {
      console.log("Custom priority asset added successfully");
      queryClient.invalidateQueries({ queryKey: ["priorityAssets"] });
      queryClient.invalidateQueries({ queryKey: ["customPriorityAssets"] });
    },
    onError: (error) => {
      console.error("Error adding custom priority asset:", error);
    },
  });
}

export function useGetCustomPriorityAssets() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<[string, string][]>({
    queryKey: ["customPriorityAssets"],
    queryFn: async () => {
      if (!actor) return [];
      try {
        const data = await actor.getCustomPriorityAssets();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching custom priority assets:", error);
        return [];
      }
    },
    enabled: !!actor && !actorFetching,
    staleTime: 30000,
  });
}

export interface RemoveCustomPriorityAssetResponse {
  success: boolean;
  error?: string;
}

export function useRemoveCustomPriorityAsset() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      coinGeckoId: string,
    ): Promise<RemoveCustomPriorityAssetResponse> => {
      if (!actor) throw new Error("Backend connection not available");
      console.log("Removing custom priority asset:", coinGeckoId);
      const result = await actor.removeCustomPriorityAsset(coinGeckoId);
      return {
        success: result?.success === true,
        error: result?.error,
      };
    },
    onSuccess: () => {
      console.log("Custom priority asset removed successfully");
      queryClient.invalidateQueries({ queryKey: ["priorityAssets"] });
      queryClient.invalidateQueries({ queryKey: ["customPriorityAssets"] });
    },
    onError: (error) => {
      console.error("Error removing custom priority asset:", error);
    },
  });
}

/**
 * On-demand historical price fetch for backdated free-token buys.
 * Called from TransactionDialog when a buy transaction is backdated and
 * has price = 0 (free token). Returns the CoinGecko historical price for
 * the given coinGeckoId on the given date (unix ms), or null on failure
 * so callers can fall back to the current market price gracefully.
 *
 * Not a cached useQuery — it's a plain async helper bound to the current
 * actor, mirroring how other on-demand fetches are structured here.
 */
export function useGetHistoricalPrice() {
  const { actor } = useActor();

  return async (coinGeckoId: string, date: bigint): Promise<number | null> => {
    if (!actor) {
      console.error("Actor not available for historical price fetch");
      return null;
    }
    try {
      const price = await actor.getHistoricalPrice(coinGeckoId, date);
      if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
        console.warn(
          `Historical price for ${coinGeckoId} on ${date} was invalid (${price}); falling back`,
        );
        return null;
      }
      return price;
    } catch (error) {
      console.error("Error fetching historical price:", error);
      return null;
    }
  };
}

export function updatePortfolioWithMarketPrices(
  portfolio: Portfolio | null | undefined,
  marketData: MarketData[] | null | undefined,
  priorityAssets: PriorityAsset[] | null | undefined,
): Portfolio | null {
  if (!portfolio) {
    return null;
  }

  // Build price map from backend market data first (key = uppercase symbol)
  const priceMap = new Map<string, number>();
  if (Array.isArray(marketData)) {
    for (const coin of marketData) {
      if (coin?.symbol && typeof coin.price === "number" && coin.price > 0) {
        priceMap.set(coin.symbol.toUpperCase(), coin.price);
      }
    }
  }

  // Overlay priority asset prices so they take precedence for the same symbol
  if (Array.isArray(priorityAssets)) {
    for (const asset of priorityAssets) {
      if (asset?.symbol && typeof asset.price === "number" && asset.price > 0) {
        priceMap.set(asset.symbol.toUpperCase(), asset.price);
      }
    }
  }

  console.log(`\n💰 Updating portfolio with ${priceMap.size} market prices`);

  const updatedAssets = (portfolio.assets || [])
    .map((asset) => {
      if (!asset) return null;

      const marketPrice = priceMap.get(asset.symbol?.toUpperCase() || "");

      // Priority: Use market price if available and valid
      // Fallback: Use existing price only if market price is not available
      // NEVER use $0 unless both market and existing prices are 0
      let currentPrice = asset.currentPrice || 0;

      if (marketPrice && marketPrice > 0) {
        currentPrice = marketPrice;
        console.log(
          `✅ ${asset.symbol}: Updated to market price $${marketPrice.toFixed(6)}`,
        );
      } else if (currentPrice > 0) {
        console.log(
          `⚠️ ${asset.symbol}: Using existing price $${currentPrice.toFixed(6)} (no market price)`,
        );
      } else {
        console.warn(
          `❌ ${asset.symbol}: No price available (market: ${marketPrice}, existing: ${asset.currentPrice})`,
        );
      }

      // Refresh the live market price and recompute the unrealized-only
      // profitLossPercentage from that same displayed currentPrice, using the
      // exact backend canonical formula so the row's price and percentage can
      // never disagree. The remaining P&L / cost-basis fields (profitLoss,
      // realizedProfitLossPercentage, purchaseValue, currentValue,
      // totalSoldCost) stay exactly as the backend computed them, so the
      // summary cards and chart keep reading one canonical source.
      const amount = asset.amount || 0;
      const averagePrice = asset.averagePrice || 0;
      const basis = averagePrice * amount;
      const unrealizedPL =
        amount > 0 ? (currentPrice - averagePrice) * amount : 0;
      const profitLossPercentage = basis > 0 ? (unrealizedPL / basis) * 100 : 0;

      return {
        ...asset,
        currentPrice,
        profitLossPercentage,
      };
    })
    .filter(
      (asset): asset is Asset => asset !== null && (asset.amount || 0) > 0,
    );

  // Portfolio-level P&L totals are backend-canonical too. Do not recompute
  // them here; only the per-asset live price is refreshed above.
  return {
    ...portfolio,
    assets: updatedAssets,
  };
}
