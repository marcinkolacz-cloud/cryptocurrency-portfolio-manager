import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface HistoricalValue {
    totalValue: number;
    timestamp: bigint;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface MarketDataStatus {
    status: string;
    calculationQuality: number;
    apiHealth: string;
    lastUpdated: bigint;
    trackedAssetsCount: bigint;
    colorScheme: string;
}
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
export interface http_header {
    value: string;
    name: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface MarketData {
    id: bigint;
    marketCap: number;
    name: string;
    lastUpdated: bigint;
    price: number;
    symbol: string;
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
export interface HistoricalTotalValue {
    totalValue: number;
    timestamp: bigint;
}
export interface HistoricalProfitLoss {
    totalProfitLoss: number;
    timestamp: bigint;
}
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface Asset {
    currentPrice: number;
    averagePrice: number;
    name: string;
    averagePurchasePrice: number;
    profitLoss: number;
    currentValue: number;
    purchaseValue: number;
    profitLossPercentage: number;
    amount: number;
    realizedProfitLoss: number;
    symbol: string;
}
export interface Portfolio {
    id: bigint;
    historicalUnrealizedProfitLoss: Array<HistoricalUnrealizedProfitLoss>;
    historicalValues: Array<HistoricalValue>;
    totalProfitLoss: number;
    historicalTotalValue: Array<HistoricalTotalValue>;
    name: string;
    createdAt: bigint;
    assets: Array<Asset>;
    historicalProfitLoss: Array<HistoricalProfitLoss>;
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
export interface HistoricalUnrealizedProfitLoss {
    timestamp: bigint;
    unrealizedProfitLoss: number;
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
export interface UserProfile {
    theme: string;
    name: string;
    language: string;
    colorScheme: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addTransaction(portfolioId: bigint, transaction: Transaction): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createPortfolio(name: string): Promise<bigint>;
    deletePortfolio(portfolioId: bigint): Promise<void>;
    deleteTransaction(portfolioId: bigint, transactionId: bigint): Promise<void>;
    editTransaction(portfolioId: bigint, transactionId: bigint, updatedTransaction: Transaction): Promise<void>;
    fetchHistoricalPriceData(assetId: string): Promise<string>;
    fetchMarketData(): Promise<void>;
    fetchPriorityAssetPrices(): Promise<void>;
    fetchTechnicalData(assetId: string): Promise<void>;
    getAvailableAssets(): Promise<Array<string>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserProfileWithStatus(): Promise<AuthResult_1>;
    getCallerUserRole(): Promise<UserRole>;
    getMarketData(): Promise<Array<MarketData>>;
    getMarketDataStatus(): Promise<MarketDataStatus | null>;
    getPortfolioAssets(portfolioId: bigint): Promise<Array<Asset>>;
    getPortfolioHistoricalProfitLoss(portfolioId: bigint): Promise<Array<HistoricalProfitLoss>>;
    getPortfolioHistoricalTotalValue(portfolioId: bigint): Promise<Array<HistoricalTotalValue>>;
    getPortfolioHistoricalUnrealizedProfitLoss(portfolioId: bigint): Promise<Array<HistoricalUnrealizedProfitLoss>>;
    getPortfolioHistoricalValues(portfolioId: bigint): Promise<Array<HistoricalValue>>;
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
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
    updateAssetPrices(portfolioId: bigint): Promise<void>;
    updateMarketDataStatus(status: MarketDataStatus): Promise<void>;
}
