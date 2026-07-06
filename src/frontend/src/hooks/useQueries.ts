import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Asset,
  MarketData,
  Portfolio,
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
      queryClient.invalidateQueries({ queryKey: ["coinGeckoMarketData"] });
      queryClient.invalidateQueries({ queryKey: ["priorityAssetPrices"] });
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
      queryClient.invalidateQueries({ queryKey: ["coinGeckoMarketData"] });
      queryClient.invalidateQueries({ queryKey: ["priorityAssetPrices"] });
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
      queryClient.invalidateQueries({ queryKey: ["coinGeckoMarketData"] });
      queryClient.invalidateQueries({ queryKey: ["priorityAssetPrices"] });
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

export interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  price_change_percentage_24h?: number;
  sparkline_in_7d?: {
    price: number[];
  };
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

// Priority ICP ecosystem tokens that MUST always have current prices
const PRIORITY_ICP_ASSETS = [
  "folks",
  "waterneuron",
  "rujira",
  "gold-dao",
  "openchat",
  "icpswap-token",
  "iclighthouse-dao",
  "origyn-foundation",
  "sonic-2",
];

// Map of CoinGecko IDs to their expected symbols
const PRIORITY_ASSET_SYMBOL_MAP: Record<string, string> = {
  folks: "FOLKS",
  waterneuron: "WTN",
  rujira: "RJR",
  "gold-dao": "GLD",
  openchat: "CHAT",
  "icpswap-token": "ICS",
  "iclighthouse-dao": "ICL",
  "origyn-foundation": "OGY",
  "sonic-2": "SONIC",
};

// Fetch priority asset prices using CoinGecko simple/price endpoint
async function fetchPriorityAssetPricesFromCoinGecko(): Promise<
  Map<string, number>
> {
  const priceMap = new Map<string, number>();

  try {
    const idsParam = PRIORITY_ICP_ASSETS.join(",");
    console.log(
      `\n🎯 [CoinGecko Simple/Price] Fetching priority ICP assets: ${idsParam}`,
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=usd`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        `[CoinGecko Simple/Price] API failed: ${response.status} ${response.statusText}`,
      );
      return priceMap;
    }

    const data = await response.json();
    console.log("[CoinGecko Simple/Price] Response:", data);

    // Parse the response and map to symbols
    for (const assetId of PRIORITY_ICP_ASSETS) {
      const priceData = data[assetId];
      if (priceData && typeof priceData.usd === "number" && priceData.usd > 0) {
        const symbol = PRIORITY_ASSET_SYMBOL_MAP[assetId];
        priceMap.set(symbol, priceData.usd);
        console.log(
          `✅ [CoinGecko Simple/Price] ${symbol}: $${priceData.usd.toFixed(6)}`,
        );
      } else {
        const symbol = PRIORITY_ASSET_SYMBOL_MAP[assetId];
        console.warn(
          `⚠️ [CoinGecko Simple/Price] No valid price for ${symbol} (${assetId})`,
        );
      }
    }

    console.log(
      `\n📊 [CoinGecko Simple/Price] Successfully fetched ${priceMap.size}/${PRIORITY_ICP_ASSETS.length} priority asset prices`,
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[CoinGecko Simple/Price] Request timeout");
    } else {
      console.error("[CoinGecko Simple/Price] Error:", error);
    }
  }

  return priceMap;
}

// Hook to fetch priority asset prices separately
export function useFetchPriorityAssetPrices() {
  return useQuery<Map<string, number>>({
    queryKey: ["priorityAssetPrices"],
    queryFn: fetchPriorityAssetPricesFromCoinGecko,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 10000),
  });
}

export function useFetchCoinGeckoData(trackedAssets: string[] = []) {
  const { data: priorityPrices } = useFetchPriorityAssetPrices();

  return useQuery<CoinGeckoMarketData[]>({
    queryKey: ["coinGeckoMarketData", trackedAssets.sort().join(",")],
    queryFn: async () => {
      if (!trackedAssets || trackedAssets.length === 0) {
        console.log("No tracked assets, skipping market data fetch");
        return [];
      }

      console.log("🚀 Fetching market data for tracked assets:", trackedAssets);

      const symbolsQuery = trackedAssets.map((s) => s.toLowerCase()).join(",");
      const allData: CoinGeckoMarketData[] = [];

      // Fetch all tracked assets by symbols from CoinGecko
      try {
        console.log("[CoinGecko Markets] Fetching tracked assets...");
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&symbols=${symbolsQuery}&order=market_cap_desc&per_page=250&page=1&sparkline=false`,
          {
            headers: {
              Accept: "application/json",
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            allData.push(...data);
            console.log(
              `✅ [CoinGecko Markets] Fetched ${data.length} tracked assets`,
            );
          }
        } else {
          console.error(
            `[CoinGecko Markets] Failed to fetch tracked assets: ${response.status}`,
          );
        }
      } catch (error) {
        console.error(
          "[CoinGecko Markets] Error fetching tracked assets:",
          error,
        );
      }

      // Identify which priority assets are tracked
      const trackedPrioritySymbols = trackedAssets.filter((symbol) => {
        const upperSymbol = symbol.toUpperCase();
        return Object.values(PRIORITY_ASSET_SYMBOL_MAP).includes(upperSymbol);
      });

      if (trackedPrioritySymbols.length > 0) {
        console.log(
          `\n🎯 Found ${trackedPrioritySymbols.length} priority ICP assets in tracked list:`,
          trackedPrioritySymbols,
        );

        // Use priority prices from the separate query
        if (priorityPrices && priorityPrices.size > 0) {
          console.log("✅ Using priority prices from dedicated query");

          // Update or add priority asset prices
          for (const symbol of trackedPrioritySymbols) {
            const upperSymbol = symbol.toUpperCase();
            const price = priorityPrices.get(upperSymbol);

            if (price && price > 0) {
              // Find if asset already exists in allData
              const existingIndex = allData.findIndex(
                (coin) => coin.symbol.toUpperCase() === upperSymbol,
              );

              if (existingIndex >= 0) {
                // Update existing asset with priority price
                allData[existingIndex] = {
                  ...allData[existingIndex],
                  current_price: price,
                };
                console.log(
                  `✅ Updated ${upperSymbol} with priority price: ${price.toFixed(6)}`,
                );
              } else {
                // Add new asset with priority price
                const assetId =
                  Object.entries(PRIORITY_ASSET_SYMBOL_MAP).find(
                    ([, sym]) => sym === upperSymbol,
                  )?.[0] || upperSymbol.toLowerCase();

                allData.push({
                  id: assetId,
                  symbol: upperSymbol.toLowerCase(),
                  name: upperSymbol,
                  current_price: price,
                  market_cap: 0,
                  market_cap_rank: 999999,
                });
                console.log(
                  `✅ Added ${upperSymbol} with priority price: ${price.toFixed(6)}`,
                );
              }
            } else {
              console.warn(`⚠️ No priority price available for ${upperSymbol}`);
            }
          }
        } else {
          console.warn("⚠️ Priority prices not available yet");
        }
      }

      console.log(`\n📊 Total market data returned: ${allData.length} coins`);
      return allData;
    },
    enabled: trackedAssets.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 10000),
  });
}

export function useFetchCoinGeckoDataExtended() {
  const { data: priorityPrices } = useFetchPriorityAssetPrices();

  return useQuery<CoinGeckoMarketData[]>({
    queryKey: ["coinGeckoMarketDataExtended"],
    queryFn: async () => {
      console.log(
        "🚀 Fetching extended CoinGecko market data with GUARANTEED priority ICP assets...",
      );
      const allData: CoinGeckoMarketData[] = [];
      const perPage = 250;
      const totalPages = 8;

      // Fetch top 2000 coins by market cap
      for (let page = 1; page <= totalPages; page++) {
        try {
          console.log(`[CoinGecko] Fetching page ${page}/${totalPages}...`);
          const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false`,
            {
              headers: {
                Accept: "application/json",
              },
            },
          );

          if (!response.ok) {
            console.error(
              `[CoinGecko] Failed to fetch page ${page}: ${response.status}`,
            );
            continue;
          }

          const data = await response.json();
          if (Array.isArray(data)) {
            allData.push(...data);
            console.log(`✅ [CoinGecko] Page ${page}: ${data.length} coins`);
          }

          if (page < totalPages) {
            await new Promise((resolve) => setTimeout(resolve, 300)); // Rate limiting
          }
        } catch (error) {
          console.error(`[CoinGecko] Error fetching page ${page}:`, error);
        }
      }

      // Fetch ICP ecosystem tokens
      try {
        console.log("\n[CoinGecko] Fetching ICP ecosystem category...");
        await new Promise((resolve) => setTimeout(resolve, 300));

        const icpResponse = await fetch(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=internet-computer-ecosystem&order=market_cap_desc&per_page=250&page=1&sparkline=false",
          {
            headers: {
              Accept: "application/json",
            },
          },
        );

        if (icpResponse.ok) {
          const icpData = await icpResponse.json();
          if (Array.isArray(icpData)) {
            console.log(
              `✅ [CoinGecko] Fetched ${icpData.length} ICP ecosystem tokens`,
            );

            const existingIds = new Set(allData.map((coin) => coin.id));
            const newIcpTokens = icpData.filter(
              (coin) => !existingIds.has(coin.id),
            );

            allData.push(...newIcpTokens);
            console.log(
              `✅ Added ${newIcpTokens.length} new ICP ecosystem tokens`,
            );
          }
        } else {
          console.error(
            `[CoinGecko] Failed to fetch ICP ecosystem: ${icpResponse.status}`,
          );
        }
      } catch (error) {
        console.error(
          "[CoinGecko] Error fetching ICP ecosystem tokens:",
          error,
        );
      }

      // GUARANTEED: Ensure all priority ICP assets are included with prices from simple/price endpoint
      console.log(
        "\n🎯 GUARANTEED PRIORITY ASSETS: Ensuring all priority ICP assets...",
      );

      if (priorityPrices && priorityPrices.size > 0) {
        console.log(
          `✅ Using ${priorityPrices.size} priority prices from dedicated query`,
        );

        for (const assetId of PRIORITY_ICP_ASSETS) {
          const symbol = PRIORITY_ASSET_SYMBOL_MAP[assetId];
          const price = priorityPrices.get(symbol);

          // Find if asset already exists
          const existingIndex = allData.findIndex(
            (coin) =>
              coin.id.toLowerCase() === assetId.toLowerCase() ||
              coin.symbol.toUpperCase() === symbol,
          );

          if (existingIndex >= 0) {
            // Update existing asset with priority price
            if (price && price > 0) {
              allData[existingIndex] = {
                ...allData[existingIndex],
                current_price: price,
              };
              console.log(
                `✅ Updated ${symbol} with priority price: $${price.toFixed(6)}`,
              );
            } else {
              console.warn(
                `⚠️ ${symbol} exists but no priority price available (keeping existing: $${allData[existingIndex].current_price})`,
              );
            }
          } else {
            // Add new asset with priority price
            const marketData: CoinGeckoMarketData = {
              id: assetId,
              symbol: symbol.toLowerCase(),
              name: assetId
                .split("-")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" "),
              current_price: price || 0,
              market_cap: 0,
              market_cap_rank: 999999,
            };

            allData.push(marketData);

            if (price && price > 0) {
              console.log(
                `✅ Added ${symbol} with priority price: $${price.toFixed(6)}`,
              );
            } else {
              console.warn(
                `⚠️ Added ${symbol} with $0 (no priority price available)`,
              );
            }
          }
        }
      } else {
        console.warn(
          "⚠️ Priority prices not available, adding priority assets with $0",
        );

        // Still add priority assets even without prices
        for (const assetId of PRIORITY_ICP_ASSETS) {
          const symbol = PRIORITY_ASSET_SYMBOL_MAP[assetId];
          const existingIndex = allData.findIndex(
            (coin) =>
              coin.id.toLowerCase() === assetId.toLowerCase() ||
              coin.symbol.toUpperCase() === symbol,
          );

          if (existingIndex < 0) {
            allData.push({
              id: assetId,
              symbol: symbol.toLowerCase(),
              name: assetId
                .split("-")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" "),
              current_price: 0,
              market_cap: 0,
              market_cap_rank: 999999,
            });
            console.log(
              `⚠️ Added ${symbol} with $0 (priority prices not loaded)`,
            );
          }
        }
      }

      // Final verification
      const finalIds = new Set(allData.map((coin) => coin.id.toLowerCase()));
      const verificationResults = PRIORITY_ICP_ASSETS.map((assetId) => {
        const included = finalIds.has(assetId.toLowerCase());
        const coin = allData.find(
          (c) => c.id.toLowerCase() === assetId.toLowerCase(),
        );
        const price = coin?.current_price || 0;
        return {
          asset: assetId,
          symbol: PRIORITY_ASSET_SYMBOL_MAP[assetId],
          included,
          price: price > 0 ? `$${price.toFixed(6)}` : "$0 (API failed)",
        };
      });

      console.log("\n📊 PRIORITY ICP ASSETS VERIFICATION:");
      for (const r of verificationResults) {
        const status = r.included ? "✅" : "❌";
        console.log(`${status} ${r.symbol} (${r.asset}): ${r.price}`);
      }

      const allIncluded = verificationResults.every((r) => r.included);
      const allHavePrices = verificationResults.every(
        (r) => !r.price.includes("$0"),
      );

      console.log(
        `\n🎯 Priority assets included: ${allIncluded ? "SUCCESS ✅" : "FAILED ❌"}`,
      );
      console.log(
        `💰 All have prices: ${allHavePrices ? "YES ✅" : "NO ⚠️ (some API calls failed)"}`,
      );

      console.log(
        `\n📊 Total extended CoinGecko data: ${allData.length} coins`,
      );
      return allData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: 3000,
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
  marketData: CoinGeckoMarketData[] | null | undefined,
): Portfolio | null {
  if (!portfolio || !marketData || !Array.isArray(marketData)) {
    return portfolio || null;
  }

  const priceMap = new Map<string, number>();
  for (const coin of marketData) {
    if (
      coin?.symbol &&
      typeof coin.current_price === "number" &&
      coin.current_price > 0
    ) {
      priceMap.set(coin.symbol.toUpperCase(), coin.current_price);
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
