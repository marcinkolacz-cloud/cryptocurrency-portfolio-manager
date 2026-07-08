// Migration for the Asset type change: added totalSoldCost and
// realizedProfitLossPercentage fields (both defaulting to 0.0 on upgrade).
// recalculateAssets (next edit/delete) recomputes correct values, and
// updateAssets accumulates correctly on subsequent sells, so 0.0 defaults
// are safe on upgrade.
import AccessControl "mo:caffeineai-authorization/access-control";
import OrderedMap "mo:base/OrderedMap";
import Map "mo:core/Map";
import Principal "mo:base/Principal";
import Int "mo:base/Int";
import Array "mo:base/Array";

module {
  // ---- Old types (matching .old/src/backend/dist/backend.most) ----

  // Old Asset: 11 fields, NO totalSoldCost / realizedProfitLossPercentage.
  public type OldAsset = {
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
  };

  public type OldTransaction = {
    id : Nat;
    assetSymbol : Text;
    assetName : Text;
    amount : Float;
    price : Float;
    type_ : Text;
    date : Int;
    comment : Text;
  };

  public type OldHistoricalValue = { timestamp : Int; totalValue : Float };
  public type OldHistoricalProfitLoss = { timestamp : Int; totalProfitLoss : Float };
  public type OldHistoricalUnrealizedProfitLoss = { timestamp : Int; unrealizedProfitLoss : Float };
  public type OldHistoricalTotalValue = { timestamp : Int; totalValue : Float };

  public type OldPortfolio = {
    id : Nat;
    name : Text;
    createdAt : Int;
    assets : [OldAsset];
    transactions : [OldTransaction];
    totalProfitLoss : Float;
    unrealizedProfitLoss : Float;
    historicalValues : [OldHistoricalValue];
    historicalProfitLoss : [OldHistoricalProfitLoss];
    historicalUnrealizedProfitLoss : [OldHistoricalUnrealizedProfitLoss];
    totalPurchaseValue : Float;
    historicalTotalValue : [OldHistoricalTotalValue];
    trackedAssets : [Text];
  };

  public type OldMarketData = {
    id : Nat;
    symbol : Text;
    name : Text;
    price : Float;
    marketCap : Float;
    lastUpdated : Int;
  };

  public type OldPriorityAsset = {
    id : Text;
    symbol : Text;
    name : Text;
    price : Float;
    marketCap : Float;
    lastUpdated : Int;
  };

  public type OldTechnicalData = {
    symbol : Text;
    name : Text;
    currentPrice : Float;
    marketCap : Float;
    change24h : Float;
    volume24h : Float;
    lastUpdated : Int;
  };

  public type OldMarketDataStatus = {
    status : Text;
    lastUpdated : Int;
    calculationQuality : Float;
    trackedAssetsCount : Nat;
    apiHealth : Text;
    colorScheme : Text;
  };

  public type OldUserProfile = {
    name : Text;
    theme : Text;
    language : Text;
    colorScheme : Text;
  };

  // mo:base OrderedMap.Map is an opaque type from the module; alias directly
  // to it so the migration's OldActor/NewActor field types match the actual
  // stable signature in .old/src/backend/dist/backend.most.
  public type OrderedMapMap<K, V> = OrderedMap.Map<K, V>;

  // mo:core Map.Map shape: {var root : Node; var size : Nat}. Map.Node is not
  // publicly re-exported from mo:core/Map, so we alias directly to Map.Map
  // (which already carries the {var root; var size} shape).
  public type CoreMapMap<K, V> = Map.Map<K, V>;

  // OldActor: 18 stable vars matching the previously deployed signature.
  public type OldActor = {
    var _acAdminAssigned : Bool;
    var _acState : {
      var adminAssigned : Bool;
      userRoles : CoreMapMap<Principal, AccessControl.UserRole>;
    };
    var _acUserRoles : [(Principal, AccessControl.UserRole)];
    var accessControlState : {
      var adminAssigned : Bool;
      var userRoles : OrderedMapMap<Principal, AccessControl.UserRole>;
    };
    var isSystemHealthy : Bool;
    var lastHealthCheck : Int;
    var lastMarketDataError : ?Text;
    var lastMarketDataErrorTimestamp : ?Int;
    var lastPriorityAssetsError : ?Text;
    var lastPriorityAssetsErrorTimestamp : ?Int;
    var lastTechnicalDataError : ?Text;
    var lastTechnicalDataErrorTimestamp : ?Int;
    var marketData : OrderedMapMap<Nat, OldMarketData>;
    var marketDataStatus : OrderedMapMap<Nat, OldMarketDataStatus>;
    var portfolios : OrderedMapMap<Principal, [OldPortfolio]>;
    var priorityAssets : OrderedMapMap<Nat, OldPriorityAsset>;
    var technicalData : OrderedMapMap<Nat, OldTechnicalData>;
    var userProfiles : OrderedMapMap<Principal, OldUserProfile>;
  };

  // ---- New types (matching current main.mo) ----

  public type NewAsset = {
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

  public type NewTransaction = OldTransaction;

  public type NewHistoricalValue = OldHistoricalValue;
  public type NewHistoricalProfitLoss = OldHistoricalProfitLoss;
  public type NewHistoricalUnrealizedProfitLoss = OldHistoricalUnrealizedProfitLoss;
  public type NewHistoricalTotalValue = OldHistoricalTotalValue;

  public type NewPortfolio = {
    id : Nat;
    name : Text;
    createdAt : Int;
    assets : [NewAsset];
    transactions : [NewTransaction];
    totalProfitLoss : Float;
    unrealizedProfitLoss : Float;
    historicalValues : [NewHistoricalValue];
    historicalProfitLoss : [NewHistoricalProfitLoss];
    historicalUnrealizedProfitLoss : [NewHistoricalUnrealizedProfitLoss];
    totalPurchaseValue : Float;
    historicalTotalValue : [NewHistoricalTotalValue];
    trackedAssets : [Text];
  };

  public type NewMarketData = OldMarketData;
  public type NewPriorityAsset = OldPriorityAsset;
  public type NewTechnicalData = OldTechnicalData;
  public type NewMarketDataStatus = OldMarketDataStatus;
  public type NewUserProfile = OldUserProfile;

  public type NewActor = {
    var _acAdminAssigned : Bool;
    var _acState : {
      var adminAssigned : Bool;
      userRoles : CoreMapMap<Principal, AccessControl.UserRole>;
    };
    var _acUserRoles : [(Principal, AccessControl.UserRole)];
    var accessControlState : {
      var adminAssigned : Bool;
      var userRoles : OrderedMapMap<Principal, AccessControl.UserRole>;
    };
    var isSystemHealthy : Bool;
    var lastHealthCheck : Int;
    var lastMarketDataError : ?Text;
    var lastMarketDataErrorTimestamp : ?Int;
    var lastPriorityAssetsError : ?Text;
    var lastPriorityAssetsErrorTimestamp : ?Int;
    var lastTechnicalDataError : ?Text;
    var lastTechnicalDataErrorTimestamp : ?Int;
    var marketData : OrderedMapMap<Nat, NewMarketData>;
    var marketDataStatus : OrderedMapMap<Nat, NewMarketDataStatus>;
    var portfolios : OrderedMapMap<Principal, [NewPortfolio]>;
    var priorityAssets : OrderedMapMap<Nat, NewPriorityAsset>;
    var technicalData : OrderedMapMap<Nat, NewTechnicalData>;
    var userProfiles : OrderedMapMap<Principal, NewUserProfile>;
  };

  // Transform an OldAsset into a NewAsset by adding the two new fields with
  // 0.0 defaults. recalculateAssets (next edit/delete) recomputes correct
  // values; updateAssets accumulates correctly on subsequent sells.
  func toNewAsset(old : OldAsset) : NewAsset = {
    symbol = old.symbol;
    name = old.name;
    amount = old.amount;
    averagePrice = old.averagePrice;
    currentPrice = old.currentPrice;
    profitLoss = old.profitLoss;
    profitLossPercentage = old.profitLossPercentage;
    purchaseValue = old.purchaseValue;
    currentValue = old.currentValue;
    realizedProfitLoss = old.realizedProfitLoss;
    averagePurchasePrice = old.averagePurchasePrice;
    totalSoldCost = 0.0;
    realizedProfitLossPercentage = 0.0;
  };

  func toNewPortfolio(old : OldPortfolio) : NewPortfolio = {
    id = old.id;
    name = old.name;
    createdAt = old.createdAt;
    assets = Array.map(old.assets, toNewAsset);
    transactions = old.transactions;
    totalProfitLoss = old.totalProfitLoss;
    unrealizedProfitLoss = old.unrealizedProfitLoss;
    historicalValues = old.historicalValues;
    historicalProfitLoss = old.historicalProfitLoss;
    historicalUnrealizedProfitLoss = old.historicalUnrealizedProfitLoss;
    totalPurchaseValue = old.totalPurchaseValue;
    historicalTotalValue = old.historicalTotalValue;
    trackedAssets = old.trackedAssets;
  };

  // The migration entry point. Maps over old.portfolios (a mo:base
  // OrderedMap.Map keyed by Principal) to add the two new Asset fields
  // (0.0 defaults) to every asset in every portfolio, and passes all other
  // 17 stable vars through unchanged.
  public func run(old : OldActor) : NewActor {
    // OrderedMap.Make(cmp).map transforms each value while preserving the
    // red-black tree structure and keys, so we do not need to rebuild the
    // map via entries/put. The actor uses Principal.compare for this map.
    let principalMap = OrderedMap.Make(Principal.compare);
    let newPortfolios = principalMap.map(
      old.portfolios,
      func(_principal, oldPortfoliosList) {
        Array.map(oldPortfoliosList, toNewPortfolio);
      },
    );

    {
      var _acAdminAssigned = old._acAdminAssigned;
      var _acState = old._acState;
      var _acUserRoles = old._acUserRoles;
      var accessControlState = old.accessControlState;
      var isSystemHealthy = old.isSystemHealthy;
      var lastHealthCheck = old.lastHealthCheck;
      var lastMarketDataError = old.lastMarketDataError;
      var lastMarketDataErrorTimestamp = old.lastMarketDataErrorTimestamp;
      var lastPriorityAssetsError = old.lastPriorityAssetsError;
      var lastPriorityAssetsErrorTimestamp = old.lastPriorityAssetsErrorTimestamp;
      var lastTechnicalDataError = old.lastTechnicalDataError;
      var lastTechnicalDataErrorTimestamp = old.lastTechnicalDataErrorTimestamp;
      var marketData = old.marketData;
      var marketDataStatus = old.marketDataStatus;
      var portfolios = newPortfolios;
      var priorityAssets = old.priorityAssets;
      var technicalData = old.technicalData;
      var userProfiles = old.userProfiles;
    };
  };
};
