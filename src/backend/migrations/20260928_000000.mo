// Enhanced Migration chain — fourth entry.
//
// Second one-time repair of stale derived asset fields. The previous entry
// (20260927_000000.mo) already recomputed `Asset.profitLossPercentage` with the
// canonical unrealized-only formula, but it has already run on the deployed
// canister and will not re-run, so assets whose stored percentage was still
// stale (e.g. NEAR showing 1.99% instead of ~337.8%) remain wrong. This entry
// recomputes it once more, at upgrade, for every stored asset.
//
// The formula is the canonical one already used by `updateAssets` and
// `updateAssetPrices` (main.mo): unrealized-only over the same cost basis the
// dollar unrealized uses.
//   unrealizedPL         = if (amount > 0.0) { (currentPrice - averagePrice) * amount } else { 0.0 }
//   unrealizedCostBasis  = averagePrice * amount
//   profitLossPercentage = if (unrealizedCostBasis > 0.0) { (unrealizedPL / unrealizedCostBasis) * 100.0 } else { 0.0 }
//
// Only `profitLossPercentage` is touched. `profitLoss`, `purchaseValue`,
// `currentValue`, `realizedProfitLoss`, `averagePurchasePrice`, `totalSoldCost`
// and `realizedProfitLossPercentage` are carried through unchanged: they are
// either canonical realized+unrealized totals or sell-scaled values that cannot
// be derived from the asset record alone.
//
// OldActor must exactly match the NewActor of the preceding migration
// (20260927_000000.mo), which is the previously deployed stable shape. The
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
    status : Text;
    lastUpdated : Int;
    calculationQuality : Float;
    trackedAssetsCount : Nat;
    apiHealth : Text;
    colorScheme : Text;
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
    var portfolios : OrderedMap.Map<Principal, [Portfolio]>;
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
  };

  // Stable shape unchanged — only asset.profitLossPercentage values are repaired.
  type NewActor = OldActor;

  // Recompute the canonical unrealized-only profitLossPercentage for one asset,
  // leaving every other field untouched.
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
    { asset with profitLossPercentage };
  };

  // Recompute every asset's profitLossPercentage across every portfolio of
  // every user. All other stable fields are carried through unchanged.
  public func migration(old : OldActor) : NewActor {
    let principalMap = OrderedMap.Make(Principal.compare);
    let updatedPortfolios = principalMap.map(
      old.portfolios,
      func(_principal, userPortfolios) {
        userPortfolios.map(
          func(p) {
            { p with assets = p.assets.map(recomputeAsset) };
          },
        );
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
    };
  };
};
