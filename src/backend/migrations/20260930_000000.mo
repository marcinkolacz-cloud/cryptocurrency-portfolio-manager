// Enhanced Migration chain — sixth entry.
//
// One-time repair of the split cost basis. Before this entry the backend kept
// TWO inconsistent bases: `asset.purchaseValue` was SELL-SCALED (multiplied by
// newAmount/oldAmount on a sell) while `unrealizedProfitLoss` was computed from
// the UNSCALED `averagePrice`. As a result `totalPurchaseValue` (sum of the
// sell-scaled purchaseValue) and `unrealizedProfitLoss` (averagePrice basis)
// were on different bases, and the frontend's derived total value matched
// neither the table Value column sum nor the Purchase-value column sum.
//
// This entry makes ONE canonical cost basis flow through everything:
//   costBasis = averagePrice * amount
// and recomputes, for every stored asset:
//   purchaseValue        = averagePrice * amount
//   unrealizedPL         = if (amount > 0.0) { (currentPrice - averagePrice) * amount } else { 0.0 }
//   profitLoss           = realizedProfitLoss + unrealizedPL
//   profitLossPercentage = if (averagePrice * amount > 0.0) { unrealizedPL / (averagePrice * amount) * 100.0 } else { 0.0 }
//   averagePurchasePrice = if (amount > 0.0) { averagePrice } else { 0.0 }
// `realizedProfitLoss`, `totalSoldCost` and `realizedProfitLossPercentage` keep
// their existing semantics and are carried through unchanged.
//
// It also adds the new `Portfolio.totalValue` field and recomputes every
// portfolio's four totals as canonical sums of the per-asset fields over assets
// with amount > 0:
//   totalPurchaseValue   = sum(asset.purchaseValue)
//   unrealizedProfitLoss = sum((currentPrice - averagePrice) * amount)
//   totalProfitLoss      = sum(asset.profitLoss)
//   totalValue           = sum(amount * currentPrice)
//
// OldActor must exactly match the NewActor of the preceding migration
// (20260929_000000.mo), which is the previously deployed stable shape. The
// deployed shape uses mo:base/OrderedMap.Map for every map field, so
// OldActor/NewActor must use OrderedMap.Map too — using mo:core/Map here would
// be a stable signature mismatch.
import OrderedMap "mo:base/OrderedMap";
import Principal "mo:base/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";

module {
  // ---- Inlined project types referenced by stable fields ----

  public type UserProfile = {
    name : Text;
    theme : Text;
    language : Text;
    colorScheme : Text;
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
    type_ : Text;
    date : Int;
    comment : Text;
  };

  // Old Portfolio shape — no totalValue field yet.
  public type OldPortfolio = {
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

  // New Portfolio shape — gains the canonical totalValue field.
  public type NewPortfolio = {
    id : Nat;
    name : Text;
    createdAt : Int;
    assets : [Asset];
    transactions : [Transaction];
    totalProfitLoss : Float;
    unrealizedProfitLoss : Float;
    totalPurchaseValue : Float;
    totalValue : Float;
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
    status : Text;
    lastUpdated : Int;
    calculationQuality : Float;
    trackedAssetsCount : Nat;
    apiHealth : Text;
    colorScheme : Text;
  };

  public type ExchangeRate = {
    rate : Float;
    lastUpdated : Int;
    sourceTimestamp : Int;
    lastError : ?Text;
  };

  // ---- Stable shape snapshot (must match the previous migration's NewActor) ----

  type OldActor = {
    var accessControlState : {
      var adminAssigned : Bool;
      var userRoles : OrderedMap.Map<Principal, AccessControl.UserRole>;
    };
    var _acAdminAssigned : Bool;
    var _acUserRoles : [(Principal, AccessControl.UserRole)];
    var _acState : AccessControl.AccessControlState;
    var lastHealthCheck : Int;
    var isSystemHealthy : Bool;
    var userProfiles : OrderedMap.Map<Principal, UserProfile>;
    var portfolios : OrderedMap.Map<Principal, [OldPortfolio]>;
    var migrationVersion : Nat;
    var marketData : OrderedMap.Map<Nat, MarketData>;
    var priorityAssets : OrderedMap.Map<Nat, PriorityAsset>;
    var technicalData : OrderedMap.Map<Nat, TechnicalData>;
    var marketDataStatus : OrderedMap.Map<Nat, MarketDataStatus>;
    var lastMarketDataError : ?Text;
    var lastMarketDataErrorTimestamp : ?Int;
    var lastPriorityAssetsError : ?Text;
    var lastPriorityAssetsErrorTimestamp : ?Int;
    var lastTechnicalDataError : ?Text;
    var lastTechnicalDataErrorTimestamp : ?Int;
    var customPriorityAssetIds : [Text];
    var customTickerMap : [(Text, Text)];
    var exchangeRate : { var value : ExchangeRate };
  };

  // All prior fields carried through, with portfolios now holding the new
  // Portfolio shape (canonical totals + totalValue).
  type NewActor = {
    var accessControlState : {
      var adminAssigned : Bool;
      var userRoles : OrderedMap.Map<Principal, AccessControl.UserRole>;
    };
    var _acAdminAssigned : Bool;
    var _acUserRoles : [(Principal, AccessControl.UserRole)];
    var _acState : AccessControl.AccessControlState;
    var lastHealthCheck : Int;
    var isSystemHealthy : Bool;
    var userProfiles : OrderedMap.Map<Principal, UserProfile>;
    var portfolios : OrderedMap.Map<Principal, [NewPortfolio]>;
    var migrationVersion : Nat;
    var marketData : OrderedMap.Map<Nat, MarketData>;
    var priorityAssets : OrderedMap.Map<Nat, PriorityAsset>;
    var technicalData : OrderedMap.Map<Nat, TechnicalData>;
    var marketDataStatus : OrderedMap.Map<Nat, MarketDataStatus>;
    var lastMarketDataError : ?Text;
    var lastMarketDataErrorTimestamp : ?Int;
    var lastPriorityAssetsError : ?Text;
    var lastPriorityAssetsErrorTimestamp : ?Int;
    var lastTechnicalDataError : ?Text;
    var lastTechnicalDataErrorTimestamp : ?Int;
    var customPriorityAssetIds : [Text];
    var customTickerMap : [(Text, Text)];
    var exchangeRate : { var value : ExchangeRate };
  };

  // Recompute one asset onto the canonical cost basis. realizedProfitLoss,
  // totalSoldCost and realizedProfitLossPercentage are carried through.
  func recomputeAsset(asset : Asset) : Asset {
    let unrealizedPL = if (asset.amount > 0.0) {
      (asset.currentPrice - asset.averagePrice) * asset.amount;
    } else {
      0.0;
    };
    let unrealizedCostBasis = asset.averagePrice * asset.amount;
    let profitLossPercentage = if (unrealizedCostBasis > 0.0) {
      (unrealizedPL / unrealizedCostBasis) * 100.0;
    } else {
      0.0;
    };
    let averagePurchasePrice = if (asset.amount > 0.0) {
      asset.averagePrice;
    } else {
      0.0;
    };
    {
      symbol = asset.symbol;
      name = asset.name;
      amount = asset.amount;
      averagePrice = asset.averagePrice;
      currentPrice = asset.currentPrice;
      profitLoss = asset.realizedProfitLoss + unrealizedPL;
      profitLossPercentage;
      purchaseValue = asset.averagePrice * asset.amount;
      currentValue = asset.amount * asset.currentPrice;
      realizedProfitLoss = asset.realizedProfitLoss;
      averagePurchasePrice;
      totalSoldCost = asset.totalSoldCost;
      realizedProfitLossPercentage = asset.realizedProfitLossPercentage;
    };
  };

  // Recompute one portfolio: canonical assets plus the four totals as sums of
  // the per-asset fields over assets with amount > 0.
  func recomputePortfolio(p : OldPortfolio) : NewPortfolio {
    let assets = p.assets.map(recomputeAsset);
    var totalProfitLoss : Float = 0.0;
    var unrealizedProfitLoss : Float = 0.0;
    var totalPurchaseValue : Float = 0.0;
    var totalValue : Float = 0.0;
    for (asset in assets.vals()) {
      if (asset.amount > 0.0) {
        totalProfitLoss := totalProfitLoss + asset.profitLoss;
        unrealizedProfitLoss := unrealizedProfitLoss + ((asset.currentPrice - asset.averagePrice) * asset.amount);
        totalPurchaseValue := totalPurchaseValue + asset.purchaseValue;
        totalValue := totalValue + (asset.amount * asset.currentPrice);
      };
    };
    {
      id = p.id;
      name = p.name;
      createdAt = p.createdAt;
      assets;
      transactions = p.transactions;
      totalProfitLoss;
      unrealizedProfitLoss;
      totalPurchaseValue;
      totalValue;
      trackedAssets = p.trackedAssets;
    };
  };

  public func migration(old : OldActor) : NewActor {
    let principalMap = OrderedMap.Make(Principal.compare);
    let updatedPortfolios = principalMap.map(
      old.portfolios,
      func(_principal, userPortfolios) {
        userPortfolios.map(recomputePortfolio);
      },
    );
    {
      var accessControlState = old.accessControlState;
      var _acAdminAssigned = old._acAdminAssigned;
      var _acUserRoles = old._acUserRoles;
      var _acState = old._acState;
      var lastHealthCheck = old.lastHealthCheck;
      var isSystemHealthy = old.isSystemHealthy;
      var userProfiles = old.userProfiles;
      var portfolios = updatedPortfolios;
      var migrationVersion = old.migrationVersion;
      var marketData = old.marketData;
      var priorityAssets = old.priorityAssets;
      var technicalData = old.technicalData;
      var marketDataStatus = old.marketDataStatus;
      var lastMarketDataError = old.lastMarketDataError;
      var lastMarketDataErrorTimestamp = old.lastMarketDataErrorTimestamp;
      var lastPriorityAssetsError = old.lastPriorityAssetsError;
      var lastPriorityAssetsErrorTimestamp = old.lastPriorityAssetsErrorTimestamp;
      var lastTechnicalDataError = old.lastTechnicalDataError;
      var lastTechnicalDataErrorTimestamp = old.lastTechnicalDataErrorTimestamp;
      var customPriorityAssetIds = old.customPriorityAssetIds;
      var customTickerMap = old.customTickerMap;
      var exchangeRate = old.exchangeRate;
    };
  };
};
