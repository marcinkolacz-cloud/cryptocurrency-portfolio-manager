import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Asset,
  MarketData,
  Portfolio,
  PriorityAsset,
  Transaction,
  UserProfile,
} from "../backend";
import { useActor } from "./useActor";

const MAX_QUERY_RETRIES = 3;
const RETRY_DELAY_BASE = 1500;

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

      const amount = asset.amount || 0;
      const averagePrice = asset.averagePrice || 0;
      const currentValue = amount * currentPrice;
      const investedValue = amount * averagePrice;
      const profitLoss = currentValue - investedValue;

      return {
        ...asset,
        currentPrice,
        profitLoss,
      };
    })
    .filter(
      (asset): asset is Asset =>
        asset !== null && (asset.amount || 0) > 0.00000001,
    );

  const unrealizedProfitLoss = updatedAssets.reduce(
    (sum, asset) => sum + (asset.profitLoss || 0),
    0,
  );
  const realizedProfitLoss = calculateRealizedProfitLoss(
    portfolio.transactions || [],
    portfolio.assets || [],
  );
  const totalProfitLoss = unrealizedProfitLoss + realizedProfitLoss;

  return {
    ...portfolio,
    assets: updatedAssets,
    totalProfitLoss,
    unrealizedProfitLoss,
  };
}

function calculateRealizedProfitLoss(
  transactions: Transaction[],
  _assets: Asset[],
): number {
  if (!Array.isArray(transactions)) return 0;

  let realizedPL = 0;
  const transactionsByAsset = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if (!tx || !tx.assetSymbol) continue;
    if (!transactionsByAsset.has(tx.assetSymbol)) {
      transactionsByAsset.set(tx.assetSymbol, []);
    }
    transactionsByAsset.get(tx.assetSymbol)!.push(tx);
  }

  for (const txs of transactionsByAsset.values()) {
    const sortedTxs = [...txs].sort((a, b) =>
      Number((a.date || 0n) - (b.date || 0n)),
    );
    let totalBought = 0;
    let totalCost = 0;

    for (const tx of sortedTxs) {
      if (!tx) continue;

      const amount = tx.amount || 0;
      const price = tx.price || 0;

      if (tx.type === "buy") {
        totalBought += amount;
        totalCost += amount * price;
      } else if (tx.type === "sell") {
        const avgPrice = totalBought > 0 ? totalCost / totalBought : 0;
        const sellValue = amount * price;
        const costBasis = amount * avgPrice;
        realizedPL += sellValue - costBasis;

        totalBought -= amount;
        totalCost -= costBasis;
      }
    }
  }

  return realizedPL;
}
