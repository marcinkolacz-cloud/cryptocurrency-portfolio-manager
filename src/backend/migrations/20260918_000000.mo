// Enhanced Migration chain — first entry.
//
// Pure legacy -> Enhanced Migration conversion: the stable shape is unchanged,
// so this migration is the identity function. Every stable field declared in
// main.mo is reproduced here with its exact type, and all project types are
// inlined (the chain must not import project files).
//
// The deployed stable shape uses mo:base/OrderedMap.Map for every map field
// (main.mo still imports OrderedMap "mo:base/OrderedMap"), so OldActor/NewActor
// must use OrderedMap.Map too — using mo:core/Map here would be a stable
// signature mismatch.
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

  // ---- Stable shape snapshot (must match main.mo exactly) ----

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

  // Pure legacy -> EM upgrade: stable shape unchanged.
  type NewActor = OldActor;

  // One-time data migration carried over from the legacy `postupgrade` hook:
  // recompute totalPurchaseValue for every existing portfolio from its assets
  // (sum of each asset's purchaseValue). Guarded by migrationVersion < 1 so it
  // runs exactly once, matching the previous behavior. The migration function
  // is the EM-correct place for upgrade-time data work.
  public func migration(old : OldActor) : NewActor {
    if (old.migrationVersion < 1) {
      let principalMap = OrderedMap.Make(Principal.compare);
      let updatedPortfolios = principalMap.map(
        old.portfolios,
        func(_principal, userPortfolios) {
          userPortfolios.map(
            func(p) {
              var total : Float = 0.0;
              for (asset in p.assets.values()) {
                total += asset.purchaseValue;
              };
              { p with totalPurchaseValue = total };
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
        var migrationVersion = 1;
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
    } else {
      old;
    };
  };
};
