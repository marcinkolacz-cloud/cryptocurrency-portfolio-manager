// Historical migration module — NOT currently wired into the actor.
//
// This module previously migrated the canister from the shared
// lastFetchError / lastFetchErrorTimestamp pair to the three per-function
// error pairs (marketData / priorityAssets / technicalData). That migration
// has already run in production: the previously deployed stable signature in
// .old/src/backend/dist/backend.most (the `out` side) already contains the
// six per-function pairs and no longer contains lastFetchError /
// lastFetchErrorTimestamp.
//
// The current main.mo stable signature is identical to that deployed
// signature, so the upgrade is stable-compatible and no explicit migration
// is required. The (with migration = Migration.run) annotation has been
// removed from main.mo; this file is retained as a standalone, self-contained
// module documenting the historical state transition. It must still compile
// on its own (mops check compiles every .mo file in the backend directory).
//
// Old stable signature source: .old/src/backend/dist/backend.most
// Migration pattern: https://internetcomputer.org/docs/motoko/fundamentals/actors/compatibility
//   ("explicit migration using a migration function")

import AccessControl "mo:caffeineai-authorization/access-control";
import OrderedMap "mo:base/OrderedMap";

module {
  // ---- Old types (inline, mirroring the previous canister signature) ----

  // mo:base/OrderedMap.Map<Principal, UserRole> as deployed in the old version.
  type OldUserRole = AccessControl.UserRole; // { #admin; #user; #guest } — unchanged

  type OldUserProfile = {
    name : Text;
    theme : Text;
    language : Text;
    colorScheme : Text;
  };

  type OldAsset = {
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

  type OldTransaction = {
    id : Nat;
    assetSymbol : Text;
    assetName : Text;
    amount : Float;
    price : Float;
    type_ : Text;
    date : Int;
    comment : Text;
  };

  type OldMarketData = {
    id : Nat;
    symbol : Text;
    name : Text;
    price : Float;
    marketCap : Float;
    lastUpdated : Int;
  };

  type OldHistoricalValue = { timestamp : Int; totalValue : Float };
  type OldHistoricalProfitLoss = { timestamp : Int; totalProfitLoss : Float };
  type OldHistoricalUnrealizedProfitLoss = {
    timestamp : Int;
    unrealizedProfitLoss : Float;
  };
  type OldHistoricalTotalValue = { timestamp : Int; totalValue : Float };

  type OldPortfolio = {
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

  type OldPriorityAsset = {
    id : Text;
    symbol : Text;
    name : Text;
    price : Float;
    marketCap : Float;
    lastUpdated : Int;
  };

  type OldTechnicalData = {
    symbol : Text;
    name : Text;
    currentPrice : Float;
    marketCap : Float;
    change24h : Float;
    volume24h : Float;
    lastUpdated : Int;
  };

  type OldMarketDataStatus = {
    status : Text;
    lastUpdated : Int;
    calculationQuality : Float;
    trackedAssetsCount : Nat;
    apiHealth : Text;
    colorScheme : Text;
  };

  // Old actor stable state — mirrors .old/src/backend/dist/backend.most.
  // Includes the two retired fields (lastFetchError / lastFetchErrorTimestamp)
  // so the migration can consume and discard them.
  type OldActor = {
    var _acAdminAssigned : Bool;
    var _acState : AccessControl.AccessControlState;
    var _acUserRoles : [(Principal, OldUserRole)];
    var accessControlState : {
      var adminAssigned : Bool;
      var userRoles : OrderedMap.Map<Principal, OldUserRole>;
    };
    var isSystemHealthy : Bool;
    var lastFetchError : ?Text;
    var lastFetchErrorTimestamp : ?Int;
    var lastHealthCheck : Int;
    var marketData : OrderedMap.Map<Nat, OldMarketData>;
    var marketDataStatus : OrderedMap.Map<Nat, OldMarketDataStatus>;
    var portfolios : OrderedMap.Map<Principal, [OldPortfolio]>;
    var priorityAssets : OrderedMap.Map<Nat, OldPriorityAsset>;
    var technicalData : OrderedMap.Map<Nat, OldTechnicalData>;
    var userProfiles : OrderedMap.Map<Principal, OldUserProfile>;
  };

  // ---- New types (identical to Old types for unchanged fields) ----
  //
  // The refactor only touched the error-tracking vars; every other stable
  // field keeps its name and type. We reuse the Old* type aliases for the
  // pass-through fields and add the three new per-function error pairs.

  type NewActor = {
    var _acAdminAssigned : Bool;
    var _acState : AccessControl.AccessControlState;
    var _acUserRoles : [(Principal, OldUserRole)];
    var accessControlState : {
      var adminAssigned : Bool;
      var userRoles : OrderedMap.Map<Principal, OldUserRole>;
    };
    var isSystemHealthy : Bool;
    var lastHealthCheck : Int;
    var marketData : OrderedMap.Map<Nat, OldMarketData>;
    var marketDataStatus : OrderedMap.Map<Nat, OldMarketDataStatus>;
    var portfolios : OrderedMap.Map<Principal, [OldPortfolio]>;
    var priorityAssets : OrderedMap.Map<Nat, OldPriorityAsset>;
    var technicalData : OrderedMap.Map<Nat, OldTechnicalData>;
    var userProfiles : OrderedMap.Map<Principal, OldUserProfile>;
    // Three new per-function error pairs (initialized to null on upgrade).
    var lastMarketDataError : ?Text;
    var lastMarketDataErrorTimestamp : ?Int;
    var lastPriorityAssetsError : ?Text;
    var lastPriorityAssetsErrorTimestamp : ?Int;
    var lastTechnicalDataError : ?Text;
    var lastTechnicalDataErrorTimestamp : ?Int;
  };

  // Absorb the old state, drop lastFetchError / lastFetchErrorTimestamp,
  // and initialize the three new per-function error pairs to null. Every
  // other stable field is passed through by reference (no transformation).
  public func run(old : OldActor) : NewActor {
    {
      var _acAdminAssigned = old._acAdminAssigned;
      var _acState = old._acState;
      var _acUserRoles = old._acUserRoles;
      var accessControlState = old.accessControlState;
      var isSystemHealthy = old.isSystemHealthy;
      // lastFetchError and lastFetchErrorTimestamp are intentionally
      // consumed (read from old) but NOT produced — they are dropped here.
      // The compiler emits a warning for this; the loss is intentional.
      var lastHealthCheck = old.lastHealthCheck;
      var marketData = old.marketData;
      var marketDataStatus = old.marketDataStatus;
      var portfolios = old.portfolios;
      var priorityAssets = old.priorityAssets;
      var technicalData = old.technicalData;
      var userProfiles = old.userProfiles;
      var lastMarketDataError = null : ?Text;
      var lastMarketDataErrorTimestamp = null : ?Int;
      var lastPriorityAssetsError = null : ?Text;
      var lastPriorityAssetsErrorTimestamp = null : ?Int;
      var lastTechnicalDataError = null : ?Text;
      var lastTechnicalDataErrorTimestamp = null : ?Int;
    };
  };
};
