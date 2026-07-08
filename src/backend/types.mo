// Public domain types shared across the portfolio backend.
//
// These types live in an imported module (not at module scope in main.mo)
// so that main.mo's only non-imported top-level declaration is the actor
// itself — required by M0141. main.mo re-exports each type as
// `public type X = Types.X;` inside the actor body to preserve the Candid
// interface (the frontend bindings depend on these exact type names).
module {
  public type UserProfile = {
    name : Text;
    theme : Text; // "light" or "dark"
    language : Text; // "pl" or "en"
    colorScheme : Text; // "default", "gray", "navy"
  };

  public type Asset = {
    symbol : Text;
    name : Text;
    amount : Float;
    averagePrice : Float;
    currentPrice : Float;
    profitLoss : Float;
    profitLossPercentage : Float;
    purchaseValue : Float;
    currentValue : Float;
    realizedProfitLoss : Float;
    averagePurchasePrice : Float;
    totalSoldCost : Float;
    realizedProfitLossPercentage : Float;
  };

  public type Transaction = {
    id : Nat;
    assetSymbol : Text;
    assetName : Text;
    amount : Float;
    price : Float;
    type_ : Text; // "buy" or "sell"
    date : Int;
    comment : Text;
  };

  // New Portfolio shape: the four historical* fields are dropped entirely
  // (no frontend component reads them — confirmed dead in the prior audit).
  // The migration (migration.mo) consumes the old shape and emits this one.
  public type Portfolio = {
    id : Nat;
    name : Text;
    createdAt : Int;
    assets : [Asset];
    transactions : [Transaction];
    totalProfitLoss : Float;
    unrealizedProfitLoss : Float;
    totalPurchaseValue : Float;
    trackedAssets : [Text];
  };

  public type MarketData = {
    id : Nat;
    symbol : Text;
    name : Text;
    price : Float;
    marketCap : Float;
    lastUpdated : Int;
  };

  public type PriorityAsset = {
    id : Text;
    symbol : Text;
    name : Text;
    price : Float;
    marketCap : Float;
    lastUpdated : Int;
  };

  public type TechnicalData = {
    symbol : Text;
    name : Text;
    currentPrice : Float;
    marketCap : Float;
    change24h : Float;
    volume24h : Float;
    lastUpdated : Int;
  };

  public type MarketDataStatus = {
    status : Text; // "loading", "connected", "error"
    lastUpdated : Int;
    calculationQuality : Float;
    trackedAssetsCount : Nat;
    apiHealth : Text; // "healthy", "degraded", "unavailable"
    colorScheme : Text; // "default", "gray", "navy"
  };
};
