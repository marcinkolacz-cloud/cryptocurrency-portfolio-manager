// Enhanced Migration chain — second entry.
//
// Fixes the admin-state initialization gap: `_acState` was declared type-only
// in main.mo and never assigned, so on a fresh deploy the AccessControl state
// was invalid and AccessControl.getUserRole trapped ("User is not registered")
// for every caller. This migration initializes `_acState` via
// AccessControl.initState() when it is not already populated, and preserves an
// already-populated state on upgrade.
//
// OldActor must exactly match the NewActor of the preceding migration
// (20260918_000000.mo), which is the previously deployed stable shape. The
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

  // Stable shape unchanged — only the `_acState` value is repaired.
  type NewActor = OldActor;

  // Initialize `_acState` when it is not already populated; otherwise preserve
  // the existing state. "Populated" means adminAssigned is true OR userRoles is
  // non-empty. Every other field is carried through unchanged.
  public func migration(old : OldActor) : NewActor {
    let acStatePopulated =
      old._acState.adminAssigned or not old._acState.userRoles.isEmpty();
    let acState = if (acStatePopulated) {
      old._acState;
    } else {
      AccessControl.initState();
    };
    {
      var accessControlState = old.accessControlState;
      var _acAdminAssigned = old._acAdminAssigned;
      var _acUserRoles = old._acUserRoles;
      var _acState = acState;
      var lastHealthCheck = old.lastHealthCheck;
      var isSystemHealthy = old.isSystemHealthy;
      var userProfiles = old.userProfiles;
      var portfolios = old.portfolios;
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
