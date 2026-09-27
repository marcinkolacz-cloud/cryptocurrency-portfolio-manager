// Enhanced Migration chain — fifth entry.
//
// Adds the USD -> PLN exchange-rate cache to the stable shape. The rate is a
// display-layer conversion factor only: every stored monetary value stays
// USD-denominated and no P&L or cost-basis calculation reads it.
//
// OldActor must exactly match the NewActor of the preceding migration
// (20260928_000000.mo), which is the previously deployed stable shape. The
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

  // All prior fields carried through unchanged, plus the new exchange-rate
  // cache initialized to an empty (never-fetched) value.
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
    var exchangeRate : { var value : ExchangeRate };
  };

  public func migration(old : OldActor) : NewActor {
    {
      var accessControlState = old.accessControlState;
      var _acAdminAssigned = old._acAdminAssigned;
      var _acUserRoles = old._acUserRoles;
      var _acState = old._acState;
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
      var exchangeRate = {
        var value = {
          rate = 0.0;
          lastUpdated = 0;
          sourceTimestamp = 0;
          lastError = null;
        };
      };
    };
  };
};
