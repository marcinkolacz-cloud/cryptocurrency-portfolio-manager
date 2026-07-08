// Explicit migration module for the portfolio backend upgrade.
//
// Why this file exists: M0141 forbids type declarations at module scope in
// main.mo alongside the actor (the actor must be the only non-imported
// top-level declaration). The migration needs OldActor/NewActor/OldPortfolio
// and the Historical* types the old shape references; defining them here
// (in an imported module) keeps them out of main.mo's top level.
//
// What this migration does: the previously deployed Portfolio shape
// (in .old/src/backend/dist/backend.most) carried four historical* arrays
// that no frontend component reads. This migration drops them, emitting
// the new Portfolio shape from types.mo. Every other stable field is passed
// through unchanged. The Asset type already had totalSoldCost and
// realizedProfitLossPercentage in the deployed signature, so no Asset-level
// transformation is needed here.
import AccessControl "mo:caffeineai-authorization/access-control";
import Principal "mo:base/Principal";
import OrderedMap "mo:base/OrderedMap";
import Array "mo:base/Array";
import Types "types";

module {
  // Old Portfolio shape — mirrors the previously deployed signature in
  // .old/src/backend/dist/backend.most. The four historical* arrays are
  // consumed here (read from the old state) but NOT carried into the new
  // Portfolio, which is what drops them.
  type OldAsset = Types.Asset;
  type OldTransaction = Types.Transaction;

  type HistoricalValue = {
    timestamp : Int;
    totalValue : Float;
  };
  type HistoricalProfitLoss = {
    timestamp : Int;
    totalProfitLoss : Float;
  };
  type HistoricalUnrealizedProfitLoss = {
    timestamp : Int;
    unrealizedProfitLoss : Float;
  };
  type HistoricalTotalValue = {
    timestamp : Int;
    totalValue : Float;
  };

  type OldPortfolio = {
    id : Nat;
    name : Text;
    createdAt : Int;
    assets : [OldAsset];
    transactions : [OldTransaction];
    totalProfitLoss : Float;
    unrealizedProfitLoss : Float;
    historicalValues : [HistoricalValue];
    historicalProfitLoss : [HistoricalProfitLoss];
    historicalUnrealizedProfitLoss : [HistoricalUnrealizedProfitLoss];
    totalPurchaseValue : Float;
    historicalTotalValue : [HistoricalTotalValue];
    trackedAssets : [Text];
  };

  // OldActor — every stable field as in the previously deployed signature.
  // portfolios uses OldPortfolio (with the historical* arrays); the other
  // fields match the new actor exactly.
  type OldActor = {
    _acAdminAssigned : Bool;
    _acState : AccessControl.AccessControlState;
    _acUserRoles : [(Principal, AccessControl.UserRole)];
    accessControlState : {
      var adminAssigned : Bool;
      var userRoles : OrderedMap.Map<Principal, AccessControl.UserRole>;
    };
    customPriorityAssetIds : [Text];
    customTickerMap : [(Text, Text)];
    isSystemHealthy : Bool;
    lastHealthCheck : Int;
    lastMarketDataError : ?Text;
    lastMarketDataErrorTimestamp : ?Int;
    lastPriorityAssetsError : ?Text;
    lastPriorityAssetsErrorTimestamp : ?Int;
    lastTechnicalDataError : ?Text;
    lastTechnicalDataErrorTimestamp : ?Int;
    marketData : OrderedMap.Map<Nat, Types.MarketData>;
    marketDataStatus : OrderedMap.Map<Nat, Types.MarketDataStatus>;
    migrationVersion : Nat;
    portfolios : OrderedMap.Map<Principal, [OldPortfolio]>;
    priorityAssets : OrderedMap.Map<Nat, Types.PriorityAsset>;
    technicalData : OrderedMap.Map<Nat, Types.TechnicalData>;
    userProfiles : OrderedMap.Map<Principal, Types.UserProfile>;
  };

  // NewActor — the new stable shape. portfolios now uses the slimmed
  // Types.Portfolio (no historical* arrays). Every other field is identical
  // to OldActor, so they pass through unchanged.
  type NewActor = {
    _acAdminAssigned : Bool;
    _acState : AccessControl.AccessControlState;
    _acUserRoles : [(Principal, AccessControl.UserRole)];
    accessControlState : {
      var adminAssigned : Bool;
      var userRoles : OrderedMap.Map<Principal, AccessControl.UserRole>;
    };
    customPriorityAssetIds : [Text];
    customTickerMap : [(Text, Text)];
    isSystemHealthy : Bool;
    lastHealthCheck : Int;
    lastMarketDataError : ?Text;
    lastMarketDataErrorTimestamp : ?Int;
    lastPriorityAssetsError : ?Text;
    lastPriorityAssetsErrorTimestamp : ?Int;
    lastTechnicalDataError : ?Text;
    lastTechnicalDataErrorTimestamp : ?Int;
    marketData : OrderedMap.Map<Nat, Types.MarketData>;
    marketDataStatus : OrderedMap.Map<Nat, Types.MarketDataStatus>;
    migrationVersion : Nat;
    portfolios : OrderedMap.Map<Principal, [Types.Portfolio]>;
    priorityAssets : OrderedMap.Map<Nat, Types.PriorityAsset>;
    technicalData : OrderedMap.Map<Nat, Types.TechnicalData>;
    userProfiles : OrderedMap.Map<Principal, Types.UserProfile>;
  };

  // Map each user's old portfolios (with historical* arrays) to the new
  // slimmed Portfolio shape. The historical* fields are intentionally
  // dropped — they are consumed in the input but not produced in the
  // output, which is the canonical "drop a field intentionally" pattern.
  public func run(old : OldActor) : NewActor {
    let principalMap = OrderedMap.Make(Principal.compare);
    let newPortfolios = principalMap.map(
      old.portfolios,
      func(_, userPortfolios : [OldPortfolio]) {
        Array.map(
          userPortfolios,
          func(p : OldPortfolio) : Types.Portfolio {
            {
              id = p.id;
              name = p.name;
              createdAt = p.createdAt;
              assets = p.assets;
              transactions = p.transactions;
              totalProfitLoss = p.totalProfitLoss;
              unrealizedProfitLoss = p.unrealizedProfitLoss;
              totalPurchaseValue = p.totalPurchaseValue;
              trackedAssets = p.trackedAssets;
            };
          },
        );
      },
    );
    {
      _acAdminAssigned = old._acAdminAssigned;
      _acState = old._acState;
      _acUserRoles = old._acUserRoles;
      accessControlState = old.accessControlState;
      customPriorityAssetIds = old.customPriorityAssetIds;
      customTickerMap = old.customTickerMap;
      isSystemHealthy = old.isSystemHealthy;
      lastHealthCheck = old.lastHealthCheck;
      lastMarketDataError = old.lastMarketDataError;
      lastMarketDataErrorTimestamp = old.lastMarketDataErrorTimestamp;
      lastPriorityAssetsError = old.lastPriorityAssetsError;
      lastPriorityAssetsErrorTimestamp = old.lastPriorityAssetsErrorTimestamp;
      lastTechnicalDataError = old.lastTechnicalDataError;
      lastTechnicalDataErrorTimestamp = old.lastTechnicalDataErrorTimestamp;
      marketData = old.marketData;
      marketDataStatus = old.marketDataStatus;
      migrationVersion = old.migrationVersion;
      portfolios = newPortfolios;
      priorityAssets = old.priorityAssets;
      technicalData = old.technicalData;
      userProfiles = old.userProfiles;
    };
  };
};
