import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Asset {
    currentPrice: number;
    averagePrice: number;
    realizedProfitLossPercentage: number;
    name: string;
    averagePurchasePrice: number;
    profitLoss: number;
    currentValue: number;
    purchaseValue: number;
    profitLossPercentage: number;
    amount: number;
    totalSoldCost: number;
    realizedProfitLoss: number;
    symbol: string;
}
export type AuthResult = {
    __kind__: "ok";
    ok: Array<Portfolio>;
} | {
    __kind__: "notFound";
    notFound: string;
} | {
    __kind__: "unauthorized";
    unauthorized: string;
};
export type AuthResult_1 = {
    __kind__: "ok";
    ok: UserProfile;
} | {
    __kind__: "notFound";
    notFound: string;
} | {
    __kind__: "unauthorized";
    unauthorized: string;
};
export interface Cell {
    value: Value;
    name: string;
}
export interface ExchangeRate {
    rate: number;
    lastUpdated: bigint;
    sourceTimestamp: bigint;
    lastError?: string;
}
export interface HttpHeader {
    value: string;
    name: string;
}
export interface HttpRequestResult {
    status: bigint;
    body: Uint8Array;
    headers: Array<HttpHeader>;
}
export interface MarketData {
    id: bigint;
    marketCap: number;
    name: string;
    lastUpdated: bigint;
    price: number;
    symbol: string;
}
export interface MarketDataStatus {
    status: string;
    calculationQuality: number;
    apiHealth: string;
    lastUpdated: bigint;
    trackedAssetsCount: bigint;
    colorScheme: string;
}
export interface Portfolio {
    id: bigint;
    totalProfitLoss: number;
    totalValue: number;
    name: string;
    createdAt: bigint;
    assets: Array<Asset>;
    trackedAssets: Array<string>;
    totalPurchaseValue: number;
    transactions: Array<Transaction>;
    unrealizedProfitLoss: number;
}
export interface PriorityAsset {
    id: string;
    marketCap: number;
    name: string;
    lastUpdated: bigint;
    price: number;
    symbol: string;
}
export interface RefreshResult {
    marketDataError?: string;
    priorityAssetsOk: boolean;
    marketDataOk: boolean;
    priorityAssetsError?: string;
}
export interface Result {
    hasMore: boolean;
    rows: Array<Array<Cell>>;
}
export interface TechnicalData {
    currentPrice: number;
    change24h: number;
    marketCap: number;
    name: string;
    lastUpdated: bigint;
    volume24h: number;
    symbol: string;
}
export interface Transaction {
    id: bigint;
    date: bigint;
    type: string;
    comment: string;
    assetSymbol: string;
    assetName: string;
    price: number;
    amount: number;
}
export interface TransformationInput {
    context: Uint8Array;
    response: HttpRequestResult;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<HttpHeader>;
}
export interface UserProfile {
    theme: string;
    name: string;
    language: string;
    colorScheme: string;
}
export type Value = {
    __kind__: "int";
    int: bigint;
} | {
    __kind__: "nat";
    nat: bigint;
} | {
    __kind__: "float";
    float: number;
} | {
    __kind__: "bool";
    bool: boolean;
} | {
    __kind__: "null";
    null: null;
} | {
    __kind__: "text";
    text: string;
};
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addCustomPriorityAsset(coinGeckoId: string, tickerSymbol: string): Promise<{
        error?: string;
        success: boolean;
    }>;
    addTransaction(portfolioId: bigint, transaction: Transaction): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createPortfolio(name: string): Promise<bigint>;
    deletePortfolio(portfolioId: bigint): Promise<void>;
    deleteTransaction(portfolioId: bigint, transactionId: bigint): Promise<void>;
    editTransaction(portfolioId: bigint, transactionId: bigint, updatedTransaction: Transaction): Promise<void>;
    execute(qJson: string): Promise<Result>;
    fetchHistoricalPriceData(assetId: string): Promise<string>;
    fetchMarketData(): Promise<void>;
    fetchPriorityAssetPrices(): Promise<void>;
    fetchTechnicalData(assetId: string): Promise<void>;
    getApiDoc(): Promise<string>;
    getAvailableAssets(): Promise<Array<string>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserProfileWithStatus(): Promise<AuthResult_1>;
    getCallerUserRole(): Promise<UserRole>;
    getCustomPriorityAssets(): Promise<Array<[string, string]>>;
    getExchangeRate(): Promise<ExchangeRate | null>;
    getHistoricalPrice(coinGeckoId: string, date: bigint): Promise<number>;
    getLastFetchError(): Promise<{
        marketData?: {
            error: string;
            timestamp: bigint;
        };
        priorityAssets?: {
            error: string;
            timestamp: bigint;
        };
        technicalData?: {
            error: string;
            timestamp: bigint;
        };
    }>;
    getMarketData(): Promise<Array<MarketData>>;
    getMarketDataStatus(): Promise<MarketDataStatus | null>;
    getPortfolioAssets(portfolioId: bigint): Promise<Array<Asset>>;
    getPortfolioSummary(portfolioId: bigint): Promise<{
        totalProfitLoss: number;
        totalValue: number;
        totalPurchaseValue: number;
        unrealizedProfitLoss: number;
    } | null>;
    getPortfolioTrackedAssets(portfolioId: bigint): Promise<Array<string>>;
    getPortfolioTransactions(portfolioId: bigint): Promise<Array<Transaction>>;
    getPortfolios(): Promise<Array<Portfolio>>;
    getPortfoliosWithStatus(): Promise<AuthResult>;
    getPriorityAssets(): Promise<Array<PriorityAsset>>;
    getSystemHealth(): Promise<{
        isHealthy: boolean;
        currentTime: bigint;
        lastCheck: bigint;
    }>;
    getTechnicalData(assetId: string): Promise<TechnicalData | null>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    initializeAccessControl(): Promise<void>;
    isAuthenticated(): Promise<boolean>;
    isCallerAdmin(): Promise<boolean>;
    refreshAllPrices(): Promise<RefreshResult>;
    refreshExchangeRate(): Promise<ExchangeRate>;
    removeCustomPriorityAsset(coinGeckoId: string): Promise<{
        error?: string;
        success: boolean;
    }>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    schema(): Promise<string>;
    searchCoinGeckoTokens(searchQuery: string): Promise<{
        results: Array<{
            id: string;
            name: string;
            symbol: string;
        }>;
        error?: string;
    }>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
    updateAssetPrices(portfolioId: bigint): Promise<void>;
    updateMarketDataStatus(status: MarketDataStatus): Promise<void>;
}
