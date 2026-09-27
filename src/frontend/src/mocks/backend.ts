import type {
  Asset,
  backendInterface,
  ExchangeRate,
  MarketData,
  Portfolio,
  PriorityAsset,
  Transaction,
  UserProfile,
} from "../backend";
import { UserRole } from "../backend";

/**
 * Visual-QA mock backend. Enabled only when VITE_USE_MOCK=true.
 *
 * Provides a realistic, fully-populated portfolio so the dashboard renders
 * its summary cards, asset table, allocation chart and market-data panel
 * without a live canister. The USD -> PLN rate is a plausible ~4.0 so every
 * <Money> value shows its PLN equivalent beneath the USD value.
 */

const NOW_MS = Date.now();
const NOW_NS = BigInt(NOW_MS) * 1_000_000n;

const RATE = 4.0123;

function asset(
  symbol: string,
  name: string,
  amount: number,
  averagePrice: number,
  currentPrice: number,
  realizedProfitLoss = 0,
  totalSoldCost = 0,
): Asset {
  const purchaseValue = averagePrice * amount;
  const currentValue = currentPrice * amount;
  const profitLoss = currentValue - purchaseValue;
  const profitLossPercentage =
    purchaseValue > 0 ? (profitLoss / purchaseValue) * 100 : 0;
  return {
    symbol,
    name,
    amount,
    averagePrice,
    averagePurchasePrice: averagePrice,
    currentPrice,
    currentValue,
    purchaseValue,
    profitLoss,
    profitLossPercentage,
    realizedProfitLoss,
    realizedProfitLossPercentage:
      totalSoldCost > 0 ? (realizedProfitLoss / totalSoldCost) * 100 : 0,
    totalSoldCost,
  };
}

const ASSETS: Asset[] = [
  asset("BTC", "Bitcoin", 0.42, 51200.0, 68450.25),
  asset("ETH", "Ethereum", 5.75, 2450.0, 3280.4),
  asset("SOL", "Solana", 48.0, 98.5, 172.85),
  asset("ICP", "Internet Computer", 1250.0, 9.4, 12.65),
  asset("ADA", "Cardano", 8200.0, 0.52, 0.4475, 120.5, 900.0),
];

const TOTAL_PURCHASE_VALUE = ASSETS.reduce((s, a) => s + a.purchaseValue, 0);
const UNREALIZED = ASSETS.reduce((s, a) => s + a.profitLoss, 0);
const REALIZED = ASSETS.reduce((s, a) => s + a.realizedProfitLoss, 0);
// Canonical backend totalValue: sum of amount * currentPrice over held assets.
const TOTAL_VALUE = ASSETS.reduce(
  (s, a) => s + (a.amount > 0 ? a.amount * a.currentPrice : 0),
  0,
);

const TRANSACTIONS: Transaction[] = [
  {
    id: 1n,
    date: NOW_NS - 86_400_000_000_000n * 30n,
    type: "buy",
    comment: "Initial BTC position",
    assetSymbol: "BTC",
    assetName: "Bitcoin",
    price: 51200.0,
    amount: 0.42,
  },
  {
    id: 2n,
    date: NOW_NS - 86_400_000_000_000n * 21n,
    type: "buy",
    comment: "ETH accumulation",
    assetSymbol: "ETH",
    assetName: "Ethereum",
    price: 2450.0,
    amount: 5.75,
  },
  {
    id: 3n,
    date: NOW_NS - 86_400_000_000_000n * 9n,
    type: "sell",
    comment: "Partial ADA exit",
    assetSymbol: "ADA",
    assetName: "Cardano",
    price: 0.52,
    amount: 900.0,
  },
];

const PORTFOLIO: Portfolio = {
  id: 1n,
  name: "Portfel główny",
  createdAt: NOW_NS - 86_400_000_000_000n * 60n,
  assets: ASSETS,
  trackedAssets: ASSETS.map((a) => a.symbol),
  transactions: TRANSACTIONS,
  totalPurchaseValue: TOTAL_PURCHASE_VALUE,
  unrealizedProfitLoss: UNREALIZED,
  totalProfitLoss: REALIZED + UNREALIZED,
  totalValue: TOTAL_VALUE,
};

const MARKET_DATA: MarketData[] = ASSETS.map((a, i) => ({
  id: BigInt(i + 1),
  symbol: a.symbol,
  name: a.name,
  price: a.currentPrice,
  marketCap: a.currentPrice * 19_000_000,
  lastUpdated: NOW_NS,
}));

const PRIORITY_ASSETS: PriorityAsset[] = [
  {
    id: "internet-computer",
    symbol: "ICP",
    name: "Internet Computer",
    price: 12.65,
    marketCap: 6_100_000_000,
    lastUpdated: NOW_NS,
  },
];

const PROFILE: UserProfile = {
  name: "Trader",
  theme: "dark",
  language: "pl",
  colorScheme: "default",
};

const EXCHANGE_RATE: ExchangeRate = {
  rate: RATE,
  lastUpdated: NOW_NS,
  sourceTimestamp: NOW_NS,
};

export const mockBackend: backendInterface = {
  _initializeAccessControl: async () => undefined,
  addCustomPriorityAsset: async () => ({ success: true }),
  addTransaction: async () => undefined,
  assignCallerUserRole: async () => undefined,
  createPortfolio: async () => 2n,
  deletePortfolio: async () => undefined,
  deleteTransaction: async () => undefined,
  editTransaction: async () => undefined,
  execute: async () => ({ hasMore: false, rows: [] }),
  fetchHistoricalPriceData: async () => "",
  fetchMarketData: async () => undefined,
  fetchPriorityAssetPrices: async () => undefined,
  fetchTechnicalData: async () => undefined,
  getApiDoc: async () => "",
  getAvailableAssets: async () => ASSETS.map((a) => a.symbol),
  getCallerUserProfile: async () => PROFILE,
  getCallerUserProfileWithStatus: async () => ({ __kind__: "ok", ok: PROFILE }),
  getCallerUserRole: async () => UserRole.admin,
  getCustomPriorityAssets: async () => [],
  getExchangeRate: async () => EXCHANGE_RATE,
  getHistoricalPrice: async () => 0,
  getLastFetchError: async () => ({}),
  getMarketData: async () => MARKET_DATA,
  getMarketDataStatus: async () => ({
    status: "ok",
    calculationQuality: 100,
    apiHealth: "healthy",
    lastUpdated: NOW_NS,
    trackedAssetsCount: BigInt(ASSETS.length),
    colorScheme: "default",
  }),
  getPortfolioAssets: async () => ASSETS,
  getPortfolioSummary: async () => ({
    totalProfitLoss: PORTFOLIO.totalProfitLoss,
    totalValue: TOTAL_PURCHASE_VALUE + UNREALIZED,
    totalPurchaseValue: TOTAL_PURCHASE_VALUE,
    unrealizedProfitLoss: UNREALIZED,
  }),
  getPortfolioTrackedAssets: async () => PORTFOLIO.trackedAssets,
  getPortfolioTransactions: async () => TRANSACTIONS,
  getPortfolios: async () => [PORTFOLIO],
  getPortfoliosWithStatus: async () => ({ __kind__: "ok", ok: [PORTFOLIO] }),
  getPriorityAssets: async () => PRIORITY_ASSETS,
  getSystemHealth: async () => ({
    isHealthy: true,
    currentTime: NOW_NS,
    lastCheck: NOW_NS,
  }),
  getTechnicalData: async () => null,
  getUserProfile: async () => PROFILE,
  initializeAccessControl: async () => undefined,
  isAuthenticated: async () => true,
  isCallerAdmin: async () => true,
  refreshAllPrices: async () => ({
    marketDataOk: true,
    priorityAssetsOk: true,
  }),
  refreshExchangeRate: async () => EXCHANGE_RATE,
  removeCustomPriorityAsset: async () => ({ success: true }),
  saveCallerUserProfile: async () => undefined,
  schema: async () => "",
  searchCoinGeckoTokens: async () => ({ results: [] }),
  transform: async (input) => ({
    status: 200n,
    body: input.response.body,
    headers: input.response.headers,
  }),
  updateAssetPrices: async () => undefined,
  updateMarketDataStatus: async () => undefined,
};
