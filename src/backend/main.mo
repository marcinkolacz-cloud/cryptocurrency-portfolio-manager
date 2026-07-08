import AccessControl "mo:caffeineai-authorization/access-control";
import OutCall "mo:caffeineai-http-outcalls/outcall";
import Principal "mo:base/Principal";
import OrderedMap "mo:base/OrderedMap";
import Iter "mo:core/Iter";
import Debug "mo:base/Debug";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Array "mo:base/Array";
import Int "mo:base/Int";
import Float "mo:base/Float";
import Char "mo:base/Char";
import Map "mo:core/Map";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import Json "mo:json";
import Timer "mo:base/Timer";
import Error "mo:core/Error";
import Types "types";
import Migration "migration";
import OQL "mo:caffeineai-oql";
import Expose "mo:caffeineai-oql/Expose";

// The actor must be the only non-imported top-level declaration (M0141), so
// all domain types live in the imported `Types` module and the migration
// (OldActor/NewActor/OldPortfolio + the Historical* types it references)
// lives in the imported `Migration` module. The migration drops the four
// dead historical* arrays from each Portfolio — see migration.mo.
(with migration = Migration.run) actor {
  // Re-export the domain types from the imported Types module. This does two
  // things: (1) brings the bare names into scope so the rest of the actor can
  // reference them unqualified, and (2) keeps them in the Candid interface
  // under the exact names the frontend bindings depend on. The type aliases
  // are stable-compatible with the previously deployed signature.
  public type UserProfile = Types.UserProfile;
  public type Asset = Types.Asset;
  public type Transaction = Types.Transaction;
  public type Portfolio = Types.Portfolio;
  public type MarketData = Types.MarketData;
  public type PriorityAsset = Types.PriorityAsset;
  public type TechnicalData = Types.TechnicalData;
  public type MarketDataStatus = Types.MarketDataStatus;

  // Kept for upgrade compatibility - absorbs old stable accessControlState on upgrade
   var accessControlState : {
    var adminAssigned : Bool;
    var userRoles : OrderedMap.Map<Principal, AccessControl.UserRole>;
  } = {
    var adminAssigned = false;
    var userRoles = OrderedMap.Make(Principal.compare).empty();
  };

  // Stable flat arrays - compatible with mo:base -> mo:core upgrade
   var _acAdminAssigned : Bool = false;
   var _acUserRoles : [(Principal, AccessControl.UserRole)] = [];

  // Working copy used by all AccessControl library calls
  var _acState : AccessControl.AccessControlState = AccessControl.initState();



  // System health tracking
  private var lastHealthCheck : Int = Time.now();
  private var isSystemHealthy : Bool = true;

  // Initialize auth (first caller becomes admin, others become users)
  public shared ({ caller }) func initializeAccessControl() : async () {
    AccessControl.initialize(_acState, caller);
    lastHealthCheck := Time.now();
    isSystemHealthy := true;
  };

  include MixinAuthorization(_acState);

  // System health check endpoint - restricted to admin users only
  public query ({ caller }) func getSystemHealth() : async {
    isHealthy : Bool;
    lastCheck : Int;
    currentTime : Int;
  } {
    // Only admins can check system health
    if (not (AccessControl.hasPermission(_acState, caller, #admin))) {
      Debug.trap("Unauthorized: Only administrators can check system health");
    };

    {
      isHealthy = isSystemHealthy;
      lastCheck = lastHealthCheck;
      currentTime = Time.now();
    };
  };

  // Admin-only query to inspect per-function fetch errors from refresh/outcall.
  // Mirrors the getSystemHealth admin-gating pattern. Returns a record with
  // three optional fields (one per refresh function); each field is null when
  // that function has no recorded error, or ?{ error; timestamp } when it does.
  public query ({ caller }) func getLastFetchError() : async {
    marketData : ?{ error : Text; timestamp : Int };
    priorityAssets : ?{ error : Text; timestamp : Int };
    technicalData : ?{ error : Text; timestamp : Int };
  } {
    if (not (AccessControl.hasPermission(_acState, caller, #admin))) {
      Debug.trap("Unauthorized: Only administrators can check fetch errors");
    };

    let marketData = switch (lastMarketDataError, lastMarketDataErrorTimestamp) {
      case (?e, ?t) { ?{ error = e; timestamp = t } };
      case (?e, null) { ?{ error = e; timestamp = 0 } };
      case (null, ?t) { ?{ error = ""; timestamp = t } };
      case (null, null) { null };
    };
    let priorityAssets = switch (lastPriorityAssetsError, lastPriorityAssetsErrorTimestamp) {
      case (?e, ?t) { ?{ error = e; timestamp = t } };
      case (?e, null) { ?{ error = e; timestamp = 0 } };
      case (null, ?t) { ?{ error = ""; timestamp = t } };
      case (null, null) { null };
    };
    let technicalData = switch (lastTechnicalDataError, lastTechnicalDataErrorTimestamp) {
      case (?e, ?t) { ?{ error = e; timestamp = t } };
      case (?e, null) { ?{ error = e; timestamp = 0 } };
      case (null, ?t) { ?{ error = ""; timestamp = t } };
      case (null, null) { null };
    };
    { marketData; priorityAssets; technicalData };
  };

  // Check if caller is authenticated - only returns info about the caller themselves
  // This is safe because it only reveals the caller's own authentication status
  public query ({ caller }) func isAuthenticated() : async Bool {
    AccessControl.hasPermission(_acState, caller, #user);
  };

  public type AuthResult<T> = {
    #ok : T;
    #unauthorized : Text;
    #notFound : Text;
  };

  transient let principalMap = OrderedMap.Make(Principal.compare);
  var userProfiles = principalMap.empty<UserProfile>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    // Only authenticated users (not guests) can view profiles
    if (not (AccessControl.hasPermission(_acState, caller, #user))) {
      return null;
    };
    principalMap.get(userProfiles, caller);
  };

  // Enhanced version with proper authorization feedback
  public query ({ caller }) func getCallerUserProfileWithStatus() : async AuthResult<UserProfile> {
    if (not (AccessControl.hasPermission(_acState, caller, #user))) {
      return #unauthorized("User must be authenticated to access profile. Please authenticate with Internet Identity.");
    };

    switch (principalMap.get(userProfiles, caller)) {
      case null { #notFound("User profile not found. Please create a profile first.") };
      case (?profile) { #ok(profile) };
    };
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    // Users can only view their own profile, admins can view any profile
    if (caller != user and not AccessControl.isAdmin(_acState, caller)) {
      return null;
    };
    principalMap.get(userProfiles, user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    // Only authenticated users can save profiles
    if (not (AccessControl.hasPermission(_acState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can save profiles. Please authenticate with Internet Identity and try again.");
    };
    userProfiles := principalMap.put(userProfiles, caller, profile);
    lastHealthCheck := Time.now();
  };

  transient let natMap = OrderedMap.Make<Nat>(Int.compare);
  var portfolios = principalMap.empty<[Portfolio]>();
  var migrationVersion : Nat = 0;
  var marketData = natMap.empty<MarketData>();
  var priorityAssets = natMap.empty<PriorityAsset>();
  var technicalData = natMap.empty<TechnicalData>();
  var marketDataStatus = natMap.empty<MarketDataStatus>();

  // Per-function fetch error tracking — each refresh function owns its own
  // pair so a later function's success cannot erase an earlier function's
  // error. Set when an HTTP outcall traps or Json.parse fails inside the
  // owning function, cleared on that function's next successful refresh
  // (fetchTechnicalData does not clear on success — see its comment).
  // Implicitly stable under --default-persistent-actors (matches the existing
  // state-var pattern above).
  var lastMarketDataError : ?Text = null;
  var lastMarketDataErrorTimestamp : ?Int = null;
  var lastPriorityAssetsError : ?Text = null;
  var lastPriorityAssetsErrorTimestamp : ?Int = null;
  var lastTechnicalDataError : ?Text = null;
  var lastTechnicalDataErrorTimestamp : ?Int = null;

  // Admin-managed extension of the hardcoded base priority asset list. The base
  // 10 ids live inside _refreshPriorityAssetPrices; customPriorityAssetIds
  // holds admin-added CoinGecko ids appended at refresh time. customTickerMap
  // stores (coinGeckoId, tickerSymbol) pairs for those custom ids so tickerFor
  // can resolve them. Both are implicitly stable under
  // --default-persistent-actors (same pattern as the state vars above).
  var customPriorityAssetIds : [Text] = [];
  var customTickerMap : [(Text, Text)] = [];

  // OQL exposure — eight entities. User-scoped stores (userProfiles,
  // portfolios) declare an `owner` column and use #controllerOrScoped so a
  // non-controller caller only sees its own rows; admin-only stores use
  // #controllerOnly. The portfolio entity flattens the per-user
  // `[Portfolio]` array into one row per (owner, portfolio) pair so each
  // portfolio is individually queryable.
  include Expose({
    entities = [
      // (Principal, UserProfile) — one row per user.
      OQL.Entity.manual<(Principal, Types.UserProfile)>(
        "userProfile",
        func() = principalMap.entries(userProfiles),
        "UserProfile",
        "owner",
      )
        .sample((Principal.fromText("aaaaa-aa"), {
          name = "";
          theme = "";
          language = "pl";
          colorScheme = "";
        }))
        .payload("owner", func(kv) = kv.0, OQL.PrincipalValue._toRow)
        .payload("name", func(kv) = kv.1.name, OQL.TextValue._toRow)
        .payload("theme", func(kv) = kv.1.theme, OQL.TextValue._toRow)
        .payload("language", func(kv) = kv.1.language, OQL.TextValue._toRow)
        .payload("colorScheme", func(kv) = kv.1.colorScheme, OQL.TextValue._toRow)
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),

      // (Principal, Portfolio) — flattened from portfolios : Map<Principal, [Portfolio]>.
      OQL.Entity.manual<(Principal, Types.Portfolio)>(
        "portfolio",
        func() = Iter.flatten(
          principalMap.entries(portfolios).map(
            func(kv : (Principal, [Types.Portfolio])) : Iter.Iter<(Principal, Types.Portfolio)> =
              Array.map<Types.Portfolio, (Principal, Types.Portfolio)>(
                kv.1,
                func(p : Types.Portfolio) : (Principal, Types.Portfolio) = (kv.0, p),
              ).vals(),
          ),
        ),
        "Portfolio",
        "id",
      )
        .sample((Principal.fromText("aaaaa-aa"), {
          id = 0;
          name = "";
          createdAt = 0;
          assets = [];
          transactions = [];
          totalProfitLoss = 0.0;
          unrealizedProfitLoss = 0.0;
          totalPurchaseValue = 0.0;
          trackedAssets = [];
        }))
        .payload("owner", func(kv) = kv.0, OQL.PrincipalValue._toRow)
        .payload("id", func(kv) = kv.1.id, OQL.NatValue._toRow)
        .payload("name", func(kv) = kv.1.name, OQL.TextValue._toRow)
        .payload("createdAt", func(kv) = kv.1.createdAt, OQL.IntValue._toRow)
        .payload("totalProfitLoss", func(kv) = kv.1.totalProfitLoss, OQL.FloatValue._toRow)
        .payload("unrealizedProfitLoss", func(kv) = kv.1.unrealizedProfitLoss, OQL.FloatValue._toRow)
        .payload("totalPurchaseValue", func(kv) = kv.1.totalPurchaseValue, OQL.FloatValue._toRow)
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),

      // MarketData — admin-only.
      OQL.Entity.manual<(Nat, Types.MarketData)>(
        "marketData",
        func() = natMap.entries(marketData),
        "MarketData",
        "id",
      )
        .sample((0, {
          id = 0;
          symbol = "";
          name = "";
          price = 0.0;
          marketCap = 0.0;
          lastUpdated = 0;
        }))
        .payload("id", func(kv) = kv.1.id, OQL.NatValue._toRow)
        .payload("symbol", func(kv) = kv.1.symbol, OQL.TextValue._toRow)
        .payload("name", func(kv) = kv.1.name, OQL.TextValue._toRow)
        .payload("price", func(kv) = kv.1.price, OQL.FloatValue._toRow)
        .payload("marketCap", func(kv) = kv.1.marketCap, OQL.FloatValue._toRow)
        .payload("lastUpdated", func(kv) = kv.1.lastUpdated, OQL.IntValue._toRow)
        .controllerOnly()
        .build(),

      // PriorityAsset — admin-only.
      OQL.Entity.manual<(Nat, Types.PriorityAsset)>(
        "priorityAsset",
        func() = natMap.entries(priorityAssets),
        "PriorityAsset",
        "id",
      )
        .sample((0, {
          id = "";
          symbol = "";
          name = "";
          price = 0.0;
          marketCap = 0.0;
          lastUpdated = 0;
        }))
        .payload("id", func(kv) = kv.1.id, OQL.TextValue._toRow)
        .payload("symbol", func(kv) = kv.1.symbol, OQL.TextValue._toRow)
        .payload("name", func(kv) = kv.1.name, OQL.TextValue._toRow)
        .payload("price", func(kv) = kv.1.price, OQL.FloatValue._toRow)
        .payload("marketCap", func(kv) = kv.1.marketCap, OQL.FloatValue._toRow)
        .payload("lastUpdated", func(kv) = kv.1.lastUpdated, OQL.IntValue._toRow)
        .controllerOnly()
        .build(),

      // TechnicalData — admin-only.
      OQL.Entity.manual<(Nat, Types.TechnicalData)>(
        "technicalData",
        func() = natMap.entries(technicalData),
        "TechnicalData",
        "symbol",
      )
        .sample((0, {
          symbol = "";
          name = "";
          currentPrice = 0.0;
          marketCap = 0.0;
          change24h = 0.0;
          volume24h = 0.0;
          lastUpdated = 0;
        }))
        .payload("symbol", func(kv) = kv.1.symbol, OQL.TextValue._toRow)
        .payload("name", func(kv) = kv.1.name, OQL.TextValue._toRow)
        .payload("currentPrice", func(kv) = kv.1.currentPrice, OQL.FloatValue._toRow)
        .payload("marketCap", func(kv) = kv.1.marketCap, OQL.FloatValue._toRow)
        .payload("change24h", func(kv) = kv.1.change24h, OQL.FloatValue._toRow)
        .payload("volume24h", func(kv) = kv.1.volume24h, OQL.FloatValue._toRow)
        .payload("lastUpdated", func(kv) = kv.1.lastUpdated, OQL.IntValue._toRow)
        .controllerOnly()
        .build(),

      // MarketDataStatus — admin-only (single-row table keyed at 0).
      OQL.Entity.manual<(Nat, Types.MarketDataStatus)>(
        "marketDataStatus",
        func() = natMap.entries(marketDataStatus),
        "MarketDataStatus",
        "status",
      )
        .sample((0, {
          status = "";
          lastUpdated = 0;
          calculationQuality = 0.0;
          trackedAssetsCount = 0;
          apiHealth = "";
          colorScheme = "";
        }))
        .payload("status", func(kv) = kv.1.status, OQL.TextValue._toRow)
        .payload("lastUpdated", func(kv) = kv.1.lastUpdated, OQL.IntValue._toRow)
        .payload("calculationQuality", func(kv) = kv.1.calculationQuality, OQL.FloatValue._toRow)
        .payload("trackedAssetsCount", func(kv) = kv.1.trackedAssetsCount, OQL.NatValue._toRow)
        .payload("apiHealth", func(kv) = kv.1.apiHealth, OQL.TextValue._toRow)
        .payload("colorScheme", func(kv) = kv.1.colorScheme, OQL.TextValue._toRow)
        .controllerOnly()
        .build(),

      // customPriorityAssetIds : [Text] — admin-only, one row per id.
      OQL.Entity.manual<Text>(
        "customPriorityAssetId",
        func() = customPriorityAssetIds.vals(),
        "Text",
        "id",
      )
        .sample("")
        .payload("id", func(t) = t, OQL.TextValue._toRow)
        .controllerOnly()
        .build(),

      // customTickerMap : [(Text, Text)] — admin-only, one row per (id, ticker).
      OQL.Entity.manual<(Text, Text)>(
        "customTicker",
        func() = customTickerMap.vals(),
        "CustomTicker",
        "coinGeckoId",
      )
        .sample(("", ""))
        .payload("coinGeckoId", func(kv) = kv.0, OQL.TextValue._toRow)
        .payload("tickerSymbol", func(kv) = kv.1, OQL.TextValue._toRow)
        .controllerOnly()
        .build(),
    ];
  });

  // JSON helper: walk a dot/bracket path (e.g. "market_data.current_price.usd")
  // via Json.get and return the #string value, or "" if absent/wrong type.
  private func _getText(json : Json.Json, path : Text) : Text {
    switch (Json.get(json, path)) {
      case (?(#string(text))) { text };
      case _ { "" };
    };
  };

  // JSON helper: walk a dot/bracket path via Json.get and return the #number
  // value as Float (int values are promoted to Float), or 0.0 if absent/wrong type.
  private func _getFloat(json : Json.Json, path : Text) : Float {
    switch (Json.get(json, path)) {
      case (?(#number(#float(n)))) { n };
      case (?(#number(#int(n)))) { Float.fromInt(n) };
      case _ { 0.0 };
    };
  };

  // Case-insensitive Text equality. mo:base/Char has no toLower, so we
  // lowercase ASCII manually: for chars in the uppercase range (65-90), add 32
  // to get the lowercase code point; otherwise keep as-is. Used for duplicate
  // CoinGecko id checks and customTickerMap lookups.
  private func _toLowerAscii(c : Char) : Char {
    let n = Char.toNat32(c);
    if (n >= 65 and n <= 90) {
      Char.fromNat32(n + 32);
    } else {
      c;
    };
  };

  private func _textEqualIgnoreCase(a : Text, b : Text) : Bool {
    let aChars = Text.toIter(a);
    let bChars = Text.toIter(b);
    loop {
      let aOpt = aChars.next();
      let bOpt = bChars.next();
      switch (aOpt, bOpt) {
        case (null, null) { return true };
        case (null, ?_) { return false };
        case (?_, null) { return false };
        case (?ac, ?bc) {
          if (_toLowerAscii(ac) != _toLowerAscii(bc)) { return false };
        };
      };
    };
  };

  // Helper function to verify portfolio ownership for update operations (can trap)
  private func verifyPortfolioOwnership(caller : Principal, portfolioId : Nat) : [Portfolio] {
    // First verify the caller is an authenticated user
    if (not (AccessControl.hasPermission(_acState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can access portfolios. Please authenticate with Internet Identity and try again.");
    };

    let userPortfolios = switch (principalMap.get(portfolios, caller)) {
      case null { Debug.trap("Unauthorized: No portfolios found for this user. Please create a portfolio first.") };
      case (?p) { p };
    };

    let portfolioExists = Array.find(
      userPortfolios,
      func(p) { p.id == portfolioId },
    );

    switch (portfolioExists) {
      case null { Debug.trap("Unauthorized: Portfolio not found or access denied. Please verify the portfolio ID and try again.") };
      case (?_) { userPortfolios };
    };
  };

  // Helper function to verify portfolio ownership for query operations (returns null on failure)
  private func verifyPortfolioOwnershipQuery(caller : Principal, portfolioId : Nat) : ?[Portfolio] {
    // First verify the caller is an authenticated user
    if (not (AccessControl.hasPermission(_acState, caller, #user))) {
      return null;
    };

    let userPortfolios = switch (principalMap.get(portfolios, caller)) {
      case null { return null };
      case (?p) { p };
    };

    let portfolioExists = Array.find(
      userPortfolios,
      func(p) { p.id == portfolioId },
    );

    switch (portfolioExists) {
      case null { null };
      case (?_) { ?userPortfolios };
    };
  };

  // Helper function to safely get current market price for an asset
  private func getCurrentMarketPrice(symbol : Text) : Float {
    let marketDataArray = natMap.vals(marketData).toArray();
    let assetMarketData = Array.find(
      marketDataArray,
      func(md) { Text.equal(md.symbol, symbol) },
    );

    switch (assetMarketData) {
      case null {
        let priorityAssetsArray = natMap.vals(priorityAssets).toArray();
        let priorityAsset = Array.find(
          priorityAssetsArray,
          func(pa) { Text.equal(pa.symbol, symbol) },
        );
        switch (priorityAsset) {
          case null { 0.0 };
          case (?pa) { pa.price };
        };
      };
      case (?md) { md.price };
    };
  };

  // Helper function to validate transaction data
  private func validateTransaction(transaction : Transaction) : Bool {
    // Validate that amount is positive
    if (transaction.amount <= 0.0) {
      return false;
    };

    // Validate that price is non-negative (can be 0 for free tokens)
    if (transaction.price < 0.0) {
      return false;
    };

    // Validate that symbol and name are not empty
    if (Text.size(transaction.assetSymbol) == 0 or Text.size(transaction.assetName) == 0) {
      return false;
    };

    // Validate transaction type
    if (transaction.type_ != "buy" and transaction.type_ != "sell") {
      return false;
    };

    true;
  };

  public shared ({ caller }) func createPortfolio(name : Text) : async Nat {
    // Only authenticated users can create portfolios
    if (not (AccessControl.hasPermission(_acState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can create portfolios. Please authenticate with Internet Identity and try again.");
    };

    let userPortfolios = switch (principalMap.get(portfolios, caller)) {
      case null { [] };
      case (?p) { p };
    };

    // Enforce maximum portfolio limit per user
    if (userPortfolios.size() >= 10) {
      Debug.trap("Portfolio limit reached: Cannot create more than 10 portfolios per user. Please delete an existing portfolio first.");
    };

    let newPortfolio : Portfolio = {
      id = userPortfolios.size();
      name;
      createdAt = Time.now();
      assets = [];
      transactions = [];
      totalProfitLoss = 0.0;
      unrealizedProfitLoss = 0.0;
      totalPurchaseValue = 0.0;
      trackedAssets = [];
    };

    let updatedPortfolios = Array.append(userPortfolios, [newPortfolio]);
    portfolios := principalMap.put(portfolios, caller, updatedPortfolios);
    lastHealthCheck := Time.now();
    newPortfolio.id;
  };

  public shared ({ caller }) func deletePortfolio(portfolioId : Nat) : async () {
    // Verify ownership and authentication (done inside verifyPortfolioOwnership)
    let userPortfolios = verifyPortfolioOwnership(caller, portfolioId);

    let filteredPortfolios = Array.filter(
      userPortfolios,
      func(p) { p.id != portfolioId },
    );
    portfolios := principalMap.put(portfolios, caller, filteredPortfolios);
    lastHealthCheck := Time.now();
  };

  public query ({ caller }) func getPortfolios() : async [Portfolio] {
    // Only authenticated users can view their portfolios
    if (not (AccessControl.hasPermission(_acState, caller, #user))) {
      return [];
    };

    switch (principalMap.get(portfolios, caller)) {
      case null { [] };
      case (?p) { p };
    };
  };

  // Enhanced version with proper authorization feedback
  public query ({ caller }) func getPortfoliosWithStatus() : async AuthResult<[Portfolio]> {
    if (not (AccessControl.hasPermission(_acState, caller, #user))) {
      return #unauthorized("User must be authenticated to access portfolios. Please authenticate with Internet Identity.");
    };

    switch (principalMap.get(portfolios, caller)) {
      case null { #ok([]) }; // Empty portfolio list is valid
      case (?p) { #ok(p) };
    };
  };

  public shared ({ caller }) func addTransaction(portfolioId : Nat, transaction : Transaction) : async () {
    // Verify ownership and authentication (done inside verifyPortfolioOwnership)
    let userPortfolios = verifyPortfolioOwnership(caller, portfolioId);

    // Validate transaction data
    if (not validateTransaction(transaction)) {
      Debug.trap("Invalid transaction data: Amount must be positive, price must be non-negative, symbol and name cannot be empty, and type must be 'buy' or 'sell'. Please check your input and try again.");
    };

    let updatedPortfolios = Array.map(
      userPortfolios,
      func(p) {
        if (p.id == portfolioId) {
          var updatedTransactions = Array.append(p.transactions, [transaction]);
          var updatedAssets = updateAssets(p.assets, transaction, p.transactions);
          var totalProfitLoss = calculateTotalProfitLoss(updatedAssets);
          var unrealizedProfitLoss = calculateUnrealizedProfitLoss(updatedAssets);
          var totalPurchaseValue = calculateTotalPurchaseValue(updatedAssets);

          // Update tracked assets
          var updatedTrackedAssets = updateTrackedAssets(p.trackedAssets, updatedAssets);

          {
            id = p.id;
            name = p.name;
            createdAt = p.createdAt;
            assets = updatedAssets;
            transactions = updatedTransactions;
            totalProfitLoss;
            unrealizedProfitLoss;
            totalPurchaseValue;
            trackedAssets = updatedTrackedAssets;
          };
        } else {
          p;
        };
      },
    );

    portfolios := principalMap.put(portfolios, caller, updatedPortfolios);
    lastHealthCheck := Time.now();
  };

  public shared ({ caller }) func editTransaction(portfolioId : Nat, transactionId : Nat, updatedTransaction : Transaction) : async () {
    // Verify ownership and authentication (done inside verifyPortfolioOwnership)
    let userPortfolios = verifyPortfolioOwnership(caller, portfolioId);

    // Validate transaction data
    if (not validateTransaction(updatedTransaction)) {
      Debug.trap("Invalid transaction data: Amount must be positive, price must be non-negative, symbol and name cannot be empty, and type must be 'buy' or 'sell'. Please check your input and try again.");
    };

    let updatedPortfolios = Array.map(
      userPortfolios,
      func(p) {
        if (p.id == portfolioId) {
          // Verify transaction exists in this portfolio
          let transactionExists = Array.find(
            p.transactions,
            func(t) { t.id == transactionId },
          );

          switch (transactionExists) {
            case null { Debug.trap("Unauthorized: Transaction not found in this portfolio. Please verify the transaction ID and try again.") };
            case (?_) {
              var updatedTransactions = Array.map(
                p.transactions,
                func(t) {
                  if (t.id == transactionId) {
                    updatedTransaction;
                  } else {
                    t;
                  };
                },
              );
              var updatedAssets = recalculateAssets(updatedTransactions);
              var totalProfitLoss = calculateTotalProfitLoss(updatedAssets);
              var unrealizedProfitLoss = calculateUnrealizedProfitLoss(updatedAssets);
              var totalPurchaseValue = calculateTotalPurchaseValue(updatedAssets);

              // Update tracked assets
              var updatedTrackedAssets = updateTrackedAssets(p.trackedAssets, updatedAssets);

              {
                id = p.id;
                name = p.name;
                createdAt = p.createdAt;
                assets = updatedAssets;
                transactions = updatedTransactions;
                totalProfitLoss;
                unrealizedProfitLoss;
                totalPurchaseValue;
                trackedAssets = updatedTrackedAssets;
              };
            };
          };
        } else {
          p;
        };
      },
    );

    portfolios := principalMap.put(portfolios, caller, updatedPortfolios);
    lastHealthCheck := Time.now();
  };

  public shared ({ caller }) func deleteTransaction(portfolioId : Nat, transactionId : Nat) : async () {
    // Verify ownership and authentication (done inside verifyPortfolioOwnership)
    let userPortfolios = verifyPortfolioOwnership(caller, portfolioId);

    let updatedPortfolios = Array.map(
      userPortfolios,
      func(p) {
        if (p.id == portfolioId) {
          // Verify transaction exists in this portfolio
          let transactionExists = Array.find(
            p.transactions,
            func(t) { t.id == transactionId },
          );

          switch (transactionExists) {
            case null { Debug.trap("Unauthorized: Transaction not found in this portfolio. Please verify the transaction ID and try again.") };
            case (?_) {
              var updatedTransactions = Array.filter(
                p.transactions,
                func(t) { t.id != transactionId },
              );
              var updatedAssets = recalculateAssets(updatedTransactions);
              var totalProfitLoss = calculateTotalProfitLoss(updatedAssets);
              var unrealizedProfitLoss = calculateUnrealizedProfitLoss(updatedAssets);
              var totalPurchaseValue = calculateTotalPurchaseValue(updatedAssets);

              // Update tracked assets
              var updatedTrackedAssets = updateTrackedAssets(p.trackedAssets, updatedAssets);

              {
                id = p.id;
                name = p.name;
                createdAt = p.createdAt;
                assets = updatedAssets;
                transactions = updatedTransactions;
                totalProfitLoss;
                unrealizedProfitLoss;
                totalPurchaseValue;
                trackedAssets = updatedTrackedAssets;
              };
            };
          };
        } else {
          p;
        };
      },
    );

    portfolios := principalMap.put(portfolios, caller, updatedPortfolios);
    lastHealthCheck := Time.now();
  };

  // Helper function to recalculate all assets from scratch based on transactions
  private func recalculateAssets(transactions : [Transaction]) : [Asset] {
    var assets : [Asset] = [];
    for (transaction in transactions.vals()) {
      assets := updateAssets(assets, transaction, transactions);
    };
    assets;
  };

  // Enhanced updateAssets function with proper profit/loss calculation
  func updateAssets(assets : [Asset], transaction : Transaction, allTransactions : [Transaction]) : [Asset] {
    let existingAsset = Array.find(assets, func(a) { a.symbol == transaction.assetSymbol });

    // Get current market price for the asset
    let currentMarketPrice = getCurrentMarketPrice(transaction.assetSymbol);
    let effectiveCurrentPrice = if (currentMarketPrice > 0.0) { currentMarketPrice } else { transaction.price };

    switch (existingAsset) {
      case null {
        if (transaction.type_ == "buy") {
          // Calculate initial profit/loss (should be 0 for new asset)
          let initialProfitLoss = (effectiveCurrentPrice - transaction.price) * transaction.amount;
          let initialProfitLossPercentage = if (transaction.price > 0.0) {
            ((effectiveCurrentPrice - transaction.price) / transaction.price) * 100.0;
          } else {
            if (effectiveCurrentPrice > 0.0) { 100.0 } else { 0.0 };
          };

          Array.append(
            assets,
            [{
              symbol = transaction.assetSymbol;
              name = transaction.assetName;
              amount = transaction.amount;
              averagePrice = transaction.price;
              currentPrice = effectiveCurrentPrice;
              profitLoss = initialProfitLoss;
              profitLossPercentage = initialProfitLossPercentage;
              purchaseValue = transaction.amount * transaction.price;
              currentValue = transaction.amount * effectiveCurrentPrice;
              realizedProfitLoss = 0.0;
              averagePurchasePrice = transaction.price;
              totalSoldCost = 0.0;
              realizedProfitLossPercentage = 0.0;
            }],
          );
        } else {
          assets;
        };
      };
      case (?asset) {
        let updatedAssets = Array.map(
          assets,
          func(a) {
            if (a.symbol == transaction.assetSymbol) {
              // Reject oversells at the source: a sell larger than current
              // holdings would otherwise inflate realized P&L and totalSoldCost
              // (the old code clamped newAmount to 0.0 but still used the full
              // transaction.amount in the P&L math). Mirror the frontend
              // TransactionDialog insufficient-balance check on the backend so
              // every submission path is guarded.
              if (transaction.type_ == "sell" and transaction.amount > a.amount) {
                Debug.trap(
                  "Insufficient holdings: cannot sell " #
                  Float.toText(transaction.amount) # " " #
                  transaction.assetSymbol #
                  " when only " # Float.toText(a.amount) # " are held"
                );
              };

              let newAmount = if (transaction.type_ == "buy") {
                a.amount + transaction.amount;
              } else {
                a.amount - transaction.amount;
              };

              let newAveragePrice = if (transaction.type_ == "buy") {
                if (a.amount + transaction.amount > 0.0) {
                  ((a.amount * a.averagePrice) + (transaction.amount * transaction.price)) / (a.amount + transaction.amount);
                } else {
                  a.averagePrice;
                };
              } else {
                a.averagePrice;
              };

              let newPurchaseValue = if (transaction.type_ == "buy") {
                a.purchaseValue + (transaction.amount * transaction.price);
              } else {
                if (a.amount > 0.0) {
                  let remainingRatio = newAmount / a.amount;
                  a.purchaseValue * remainingRatio;
                } else {
                  0.0;
                };
              };

              let transactionRealizedPL = if (transaction.type_ == "sell") {
                (transaction.price - a.averagePrice) * transaction.amount;
              } else {
                0.0;
              };

              let newRealizedProfitLoss = a.realizedProfitLoss + transactionRealizedPL;

              // Cumulative cost basis (at average purchase price) of everything
              // ever sold for this symbol. Carried forward across transactions
              // the same way realizedProfitLoss is, so realizedProfitLossPercentage
              // divides realized gains by the cost basis of what was actually sold
              // (not by the smaller remaining cost basis of what's still held).
              let newTotalSoldCost = if (transaction.type_ == "sell") {
                a.totalSoldCost + (transaction.amount * a.averagePrice);
              } else {
                a.totalSoldCost;
              };

              let updatedCurrentPrice = if (effectiveCurrentPrice > 0.0) {
                effectiveCurrentPrice;
              } else {
                a.currentPrice;
              };

              let newCurrentValue = newAmount * updatedCurrentPrice;

              let unrealizedPL = if (newAmount > 0.0) {
                (updatedCurrentPrice - newAveragePrice) * newAmount;
              } else {
                0.0;
              };

              let totalProfitLoss = newRealizedProfitLoss + unrealizedPL;

              // Unrealized-only: divide unrealized P/L by the cost basis of what
              // is still held (newPurchaseValue). Realized gains now live in
              // realizedProfitLossPercentage, so the old mixed formula and its
              // fully-sold fallbacks are removed.
              let profitLossPercentage = if (newPurchaseValue > 0.0) {
                (unrealizedPL / newPurchaseValue) * 100.0;
              } else {
                0.0;
              };

              // Realized-only: divide realized P/L by the cumulative cost basis
              // of everything ever sold for this symbol.
              let realizedProfitLossPercentage = if (newTotalSoldCost > 0.0) {
                (newRealizedProfitLoss / newTotalSoldCost) * 100.0;
              } else {
                0.0;
              };

              let averagePurchasePrice = if (newAmount > 0.0) {
                newPurchaseValue / newAmount;
              } else {
                0.0;
              };

              {
                symbol = a.symbol;
                name = a.name;
                amount = newAmount;
                averagePrice = newAveragePrice;
                currentPrice = updatedCurrentPrice;
                profitLoss = totalProfitLoss;
                profitLossPercentage;
                purchaseValue = newPurchaseValue;
                currentValue = newCurrentValue;
                realizedProfitLoss = newRealizedProfitLoss;
                averagePurchasePrice;
                totalSoldCost = newTotalSoldCost;
                realizedProfitLossPercentage;
              };
            } else {
              a;
            };
          },
        );
        updatedAssets;
      };
    };
  };

  func calculateTotalProfitLoss(assets : [Asset]) : Float {
    Array.foldLeft(
      assets,
      0.0,
      func(acc, asset) { acc + asset.profitLoss },
    );
  };

  func calculateUnrealizedProfitLoss(assets : [Asset]) : Float {
    var total : Float = 0.0;
    for (asset in assets.vals()) {
      if (asset.amount > 0.0 and asset.averagePrice >= 0.0 and asset.currentPrice >= 0.0) {
        let unrealizedPL = (asset.currentPrice - asset.averagePrice) * asset.amount;
        total := total + unrealizedPL;
      };
    };
    total;
  };

  func calculateTotalPurchaseValue(assets : [Asset]) : Float {
    Array.foldLeft(
      assets,
      0.0,
      func(acc, asset) { acc + asset.purchaseValue },
    );
  };

  func updateTrackedAssets(currentTrackedAssets : [Text], assets : [Asset]) : [Text] {
    let activeAssets = Array.map(
      Array.filter(
        assets,
        func(a) { a.amount > 0.0 },
      ),
      func(a) { a.symbol },
    );

    var uniqueAssets : [Text] = [];
    for (asset in activeAssets.vals()) {
      let exists = Array.find(
        uniqueAssets,
        func(a) { a == asset },
      );
      switch (exists) {
        case null {
          uniqueAssets := Array.append(uniqueAssets, [asset]);
        };
        case (?_) {};
      };
    };

    uniqueAssets;
  };

  // Transform function for HTTP outcalls
  // This is a system callback function invoked by the Internet Computer runtime
  // during HTTP outcall processing. It transforms HTTP responses and is part of
  // the IC's internal HTTP outcall mechanism.
  // Authorization: This is a system-level callback that must remain publicly accessible
  // for the IC runtime to invoke it during HTTP outcall processing. The function itself
  // does not expose sensitive data or perform privileged operations - it only transforms
  // HTTP response data according to the IC's requirements.
  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    // Canonicalize the CoinGecko response body so every replica produces a
    // byte-identical output for IC consensus. We keep ONLY the fields we need,
    // round every float to 8 decimal places, and drop every volatile/unused
    // field (last_updated_at, image, ath, sparkline, etc.). If the body is not
    // valid JSON or does not match any expected shape, fall back to the library
    // default transform so we don't break the consensus contract.
    let response = input.response;
    let bodyText = switch (response.body.decodeUtf8()) {
      case null { return OutCall.transform(input) };
      case (?t) { t };
    };

    let parsed = Json.parse(bodyText);
    let json = switch (parsed) {
      case (#err(_)) { return OutCall.transform(input) };
      case (#ok(j)) { j };
    };

    // Detect the response shape and build the canonical Json.
    let canonical : Json.Json = switch (json) {
      // /coins/markets -> array of objects
      case (#array(coins)) {
        let canonicalCoins = Array.map(
          coins,
          func(coin) {
            switch (coin) {
              case (#object_(_)) { _canonicalizeMarketCoin(coin) };
              case _ { coin };
            };
          },
        );
        #array(canonicalCoins);
      };
      // /simple/price or /coins/{id} -> object
      case (#object_(entries)) {
        // CoinGecko error responses look like {"status": {"error_code": ...,
        // "error_message": "..."}}. Detect this BEFORE the simple/price branch
        // so a rate-limit/auth error is not misrouted into _canonicalizeSimplePrice
        // (which would emit garbage like {"status":{"usd":0.0}}).
        if (_hasKey(entries, "status")) {
          // Extract error_message first, fall back to error_code, then a generic
          // message if neither is present.
          let errMsg = switch (Json.get(json, "status.error_message")) {
            case (?(#string(s))) { s };
            case _ {
              switch (Json.get(json, "status.error_code")) {
                case (?(#number(#int(n)))) { "error_code " # Int.toText(n) };
                case (?(#number(#float(n)))) { "error_code " # Float.toText(n) };
                case _ { "unknown CoinGecko error" };
              };
            };
          };
          #object_([("error", #string(errMsg))]);
        } else if (_hasKey(entries, "market_data")) {
          // Distinguish /coins/{id} (detail) from /coins/{id}/history by
          // inspecting the market_data object: the detail response has a
          // market_cap key, the /history response does NOT. If market_cap is
          // present, canonicalize as a coin detail; otherwise canonicalize as
          // a coin history (extracts only current_price.usd).
          let marketDataJson = switch (Json.get(json, "market_data")) {
            case (?md) { md };
            case null { json };
          };
          let hasMarketCap = switch (marketDataJson) {
            case (#object_(mdEntries)) { _hasKey(mdEntries, "market_cap") };
            case _ { false };
          };
          if (hasMarketCap) {
            _canonicalizeCoinDetail(json);
          } else {
            _canonicalizeCoinHistory(json);
          };
        } else if (_hasKey(entries, "coins")) {
          // /api/v3/search response: { "coins": [ { "id", "symbol", "name", ... }, ... ], ... }
          // Canonicalize to keep only id/symbol/name per coin (strings only, no floats).
          _canonicalizeSearchResponse(json);
        } else {
          // /simple/price: object keyed by coin id, each value { "usd": <price> }
          _canonicalizeSimplePrice(entries);
        };
      };
      case _ { return OutCall.transform(input) };
    };

    let canonicalText = Json.stringify(canonical, null);
    {
      response with
      body = Text.encodeUtf8(canonicalText);
    };
  };

  // Does a Json object's entry list contain a given key?
  private func _hasKey(entries : [(Text, Json.Json)], key : Text) : Bool {
    for ((k, _) in entries.vals()) {
      if (k == key) { return true };
    };
    false;
  };

  // Round a Float to 8 decimal places and return it as a Json #number #float.
  private func _round8(n : Float) : Json.Json {
    let rounded = Float.nearest(n * 1e8) / 1e8;
    #number(#float(rounded));
  };

  // Read a numeric field from a coin object as Float (int promoted to Float),
  // or 0.0 if absent/wrong type. Used by the canonicalizers below.
  private func _getFieldFloat(json : Json.Json, key : Text) : Float {
    switch (Json.get(json, key)) {
      case (?(#number(#float(n)))) { n };
      case (?(#number(#int(n)))) { Float.fromInt(n) };
      case _ { 0.0 };
    };
  };

  // /coins/markets element: keep only id, symbol, name, current_price,
  // market_cap (all floats rounded to 8 decimals).
  //
  // Single-pass extraction: pattern-match once on the coin's #object_ entries
  // instead of calling Json.get(coin, "field") five times (each re-scanning the
  // object). This keeps the per-coin cost O(n) in the entry count rather than
  // O(5n), which matters at 100 coins × 2 passes (transform + _refreshMarketData)
  // against the IC instruction budget.
  private func _canonicalizeMarketCoin(coin : Json.Json) : Json.Json {
    var id : Text = "";
    var symbol : Text = "";
    var name : Text = "";
    var currentPrice : Float = 0.0;
    var marketCap : Float = 0.0;
    switch (coin) {
      case (#object_(entries)) {
        for ((k, v) in entries.vals()) {
          if (k == "id") {
            switch (v) {
              case (#string(s)) { id := s };
              case _ {};
            };
          } else if (k == "symbol") {
            switch (v) {
              case (#string(s)) { symbol := s };
              case _ {};
            };
          } else if (k == "name") {
            switch (v) {
              case (#string(s)) { name := s };
              case _ {};
            };
          } else if (k == "current_price") {
            switch (v) {
              case (#number(#float(n))) { currentPrice := n };
              case (#number(#int(n))) { currentPrice := Float.fromInt(n) };
              case _ {};
            };
          } else if (k == "market_cap") {
            switch (v) {
              case (#number(#float(n))) { marketCap := n };
              case (#number(#int(n))) { marketCap := Float.fromInt(n) };
              case _ {};
            };
          };
        };
      };
      case _ {};
    };
    #object_([
      ("id", #string(id)),
      ("symbol", #string(symbol)),
      ("name", #string(name)),
      ("current_price", _round8(currentPrice)),
      ("market_cap", _round8(marketCap)),
    ]);
  };

  // /simple/price: object keyed by coin id, each value { "usd": <price> }.
  // Keep only the usd price per coin id, rounded to 8 decimals.
  private func _canonicalizeSimplePrice(entries : [(Text, Json.Json)]) : Json.Json {
    let canonicalEntries = Array.map<(Text, Json.Json), (Text, Json.Json)>(
      entries,
      func((id, value)) {
        let usd = switch (value) {
          case (#object_(inner)) {
            switch (Json.get(#object_(inner), "usd")) {
              case (?(#number(#float(n)))) { n };
              case (?(#number(#int(n)))) { Float.fromInt(n) };
              case _ { 0.0 };
            };
          };
          case _ { 0.0 };
        };
        (id, #object_([("usd", _round8(usd))]));
      },
    );
    #object_(canonicalEntries);
  };

  // /coins/{id}: keep id, symbol, name, and a market_data object containing
  // only price (from current_price.usd), market_cap, change_24h (from
  // price_change_percentage_24h), volume_24h (from total_volume), all rounded
  // to 8 decimals.
  private func _canonicalizeCoinDetail(coin : Json.Json) : Json.Json {
    let id = switch (Json.get(coin, "id")) {
      case (?(#string(s))) { s };
      case _ { "" };
    };
    let symbol = switch (Json.get(coin, "symbol")) {
      case (?(#string(s))) { s };
      case _ { "" };
    };
    let name = switch (Json.get(coin, "name")) {
      case (?(#string(s))) { s };
      case _ { "" };
    };
    let price = _getFloat(coin, "market_data.current_price.usd");
    let marketCap = _getFloat(coin, "market_data.market_cap.usd");
    let change24h = _getFloat(coin, "market_data.price_change_percentage_24h");
    let volume24h = _getFloat(coin, "market_data.total_volume.usd");
    #object_([
      ("id", #string(id)),
      ("symbol", #string(symbol)),
      ("name", #string(name)),
      ("market_data", #object_([
        ("price", _round8(price)),
        ("market_cap", _round8(marketCap)),
        ("change_24h", _round8(change24h)),
        ("volume_24h", _round8(volume24h)),
      ])),
    ]);
  };

  // /coins/{id}/history: extract only market_data.current_price.usd and
  // return a JSON object {"usd": <price rounded via _round8>}. The /history
  // response shape is { ..., "market_data": { "current_price": { "usd": ... } }, ... }
  // and does NOT include market_cap (which is how transform() distinguishes it
  // from /coins/{id} detail). Used by _fetchHistoricalPrice.
  private func _canonicalizeCoinHistory(json : Json.Json) : Json.Json {
    let price = _getFloat(json, "market_data.current_price.usd");
    #object_([
      ("market_data", #object_([("usd", _round8(price))])),
    ]);
  };

  // /api/v3/search element: keep only id, symbol, name (all strings). No
  // floats to round here — the search response only carries string fields we
  // care about. Single-pass extraction over the coin's #object_ entries.
  private func _canonicalizeSearchCoin(coin : Json.Json) : Json.Json {
    var id : Text = "";
    var symbol : Text = "";
    var name : Text = "";
    switch (coin) {
      case (#object_(entries)) {
        for ((k, v) in entries.vals()) {
          if (k == "id") {
            switch (v) {
              case (#string(s)) { id := s };
              case _ {};
            };
          } else if (k == "symbol") {
            switch (v) {
              case (#string(s)) { symbol := s };
              case _ {};
            };
          } else if (k == "name") {
            switch (v) {
              case (#string(s)) { name := s };
              case _ {};
            };
          };
        };
      };
      case _ {};
    };
    #object_([
      ("id", #string(id)),
      ("symbol", #string(symbol)),
      ("name", #string(name)),
    ]);
  };

  // /api/v3/search response: { "coins": [ { "id", "symbol", "name", ... }, ... ], ... }.
  // Canonicalize to {"coins": [{"id":<text>,"symbol":<text>,"name":<text>}, ...]}
  // keeping only id/symbol/name per coin. Other top-level keys (exchanges,
  // categories, nfts, etc.) are dropped.
  private func _canonicalizeSearchResponse(json : Json.Json) : Json.Json {
    let coins = switch (Json.get(json, "coins")) {
      case (?(#array(arr))) { arr };
      case _ { [] };
    };
    let canonicalCoins = Array.map(
      coins,
      func(coin) {
        switch (coin) {
          case (#object_(_)) { _canonicalizeSearchCoin(coin) };
          case _ { coin };
        };
      },
    );
    #object_([("coins", #array(canonicalCoins))]);
  };

  // Admin-only function to fetch market data for all assets
  // This is restricted to admins because it triggers expensive HTTP outcalls
  public shared ({ caller }) func fetchMarketData() : async () {
    // Only admins can fetch market data for all assets (expensive operation)
    if (not (AccessControl.hasPermission(_acState, caller, #admin))) {
      Debug.trap("Unauthorized: Only administrators can fetch market data for all assets. This is an expensive operation reserved for system maintenance.");
    };
    await _refreshMarketData();
  };

  // Internal refresh for market data — no auth gate, called by the recurring
  // timer and by the admin-only fetchMarketData public function.
  private func _refreshMarketData() : async () {
    let url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=40&page=1&sparkline=false";
    // Note: OutCall.httpGetRequest (caffeineai-http-outcalls 0.1.1) does not
    // expose a max_response_bytes option — it hardcodes null internally, so the
    // IC system API default (2MB) applies. That is comfortably larger than a
    // 100-coin /coins/markets response (~120-200KB), so no truncation is
    // expected here. The library default is used.
    let response = try await OutCall.httpGetRequest(url, [], transform) catch (err) {
      // Outcall trapped (likely IC consensus / SysTransient). Do NOT clear the
      // existing marketData map — preserve prior data and record the error.
      lastMarketDataError := ?("_refreshMarketData: " # err.message());
      lastMarketDataErrorTimestamp := ?Time.now();
      return;
    };

    let currentTime = Time.now();

    switch (Json.parse(response)) {
      case (#err(e)) {
        // Parse failed — leave marketData untouched and record the error.
        lastMarketDataError := ?("_refreshMarketData: JSON parse failed: " # Json.errToText(e));
        lastMarketDataErrorTimestamp := ?currentTime;
        lastHealthCheck := currentTime;
        return;
      };
      case (#ok(json)) {
        switch (json) {
          // CoinGecko error shape — transform() canonicalizes rate-limit/auth
          // errors to {"error": "<message>"}. Detect this BEFORE the #array
          // branch so the actual CoinGecko error message is surfaced instead
          // of being misrouted into the empty-array / unexpected-shape paths.
          case (#object_(entries)) {
            if (_hasKey(entries, "error")) {
              let errMsg = switch (Json.get(json, "error")) {
                case (?(#string(s))) { s };
                case _ { "(unparseable error message)" };
              };
              lastMarketDataError := ?("_refreshMarketData: CoinGecko returned an error: " # errMsg);
              lastMarketDataErrorTimestamp := ?currentTime;
              lastHealthCheck := currentTime;
              return;
            };
            // Other object shapes are unexpected for /coins/markets — record
            // the error, leave prior data intact.
            lastMarketDataError := ?"_refreshMarketData: unexpected JSON shape (not an array)";
            lastMarketDataErrorTimestamp := ?currentTime;
            lastHealthCheck := currentTime;
            return;
          };
          case (#array(coins)) {
            // Empty array — CoinGecko returned no coins (rate-limit shadow
            // response, malformed payload, etc.). Surface the raw response so
            // the cause is diagnosable instead of looking like a silent
            // success. Do NOT clear the marketData map; preserve prior data.
            if (coins.size() == 0) {
              let rawLen = response.size();
              // mo:base/Text@0.16.0 has no substr(); use Text.toIter +
              // Iter.take (mo:core/Iter) + Text.fromIter to extract the
              // first 300 characters of the raw response for diagnostics.
              let snippet = Text.fromIter(Text.toIter(response).take(300));
              lastMarketDataError := ?(
                "_refreshMarketData: Parsed successfully but array was empty. Raw response length: "
                # Int.toText(rawLen)
                # " chars, first 300 chars: "
                # snippet
              );
              lastMarketDataErrorTimestamp := ?currentTime;
              lastHealthCheck := currentTime;
              return;
            };
            // Clear the existing marketData map before inserting fresh entries
            // (only once we know the parse succeeded and we have a non-empty array).
            marketData := natMap.empty<MarketData>();
            var index : Nat = 0;
            for (coin in coins.vals()) {
              // Single-pass extraction over the canonical coin's #object_
              // entries. By this point transform() has already reduced each
              // coin to the 5 flat keys (id, symbol, name, current_price,
              // market_cap), so direct key match is enough — no path/dot
              // parsing needed. This avoids 4× per-coin Json.get path walks
              // (the prior _getText/_getFloat calls) that blew the IC
              // instruction budget at 100 coins.
              var idText : Text = "";
              var symbol : Text = "";
              var name : Text = "";
              var price : Float = 0.0;
              var marketCap : Float = 0.0;
              switch (coin) {
                case (#object_(entries)) {
                  for ((k, v) in entries.vals()) {
                    if (k == "id") {
                      switch (v) {
                        case (#string(s)) { idText := s };
                        case _ {};
                      };
                    } else if (k == "symbol") {
                      switch (v) {
                        case (#string(s)) { symbol := s };
                        case _ {};
                      };
                    } else if (k == "name") {
                      switch (v) {
                        case (#string(s)) { name := s };
                        case _ {};
                      };
                    } else if (k == "current_price") {
                      switch (v) {
                        case (#number(#float(n))) { price := n };
                        case (#number(#int(n))) { price := Float.fromInt(n) };
                        case _ {};
                      };
                    } else if (k == "market_cap") {
                      switch (v) {
                        case (#number(#float(n))) { marketCap := n };
                        case (#number(#int(n))) { marketCap := Float.fromInt(n) };
                        case _ {};
                      };
                    };
                  };
                };
                case _ {};
              };
              marketData := natMap.put(
                marketData,
                index,
                {
                  id = index;
                  symbol;
                  name;
                  price;
                  marketCap;
                  lastUpdated = currentTime;
                },
              );
              index := index + 1;
            };
            // Successful refresh — clear any prior fetch error.
            lastMarketDataError := null;
            lastMarketDataErrorTimestamp := null;
          };
          case _ {
            // Unexpected shape — record the error, leave prior data intact.
            lastMarketDataError := ?"_refreshMarketData: unexpected JSON shape (not an array)";
            lastMarketDataErrorTimestamp := ?currentTime;
          };
        };
        lastHealthCheck := currentTime;
      };
    };
  };

  // Admin-only function to fetch priority asset prices
  // This is restricted to admins because it triggers HTTP outcalls
  public shared ({ caller }) func fetchPriorityAssetPrices() : async () {
    // Only admins can fetch priority asset prices (expensive operation)
    if (not (AccessControl.hasPermission(_acState, caller, #admin))) {
      Debug.trap("Unauthorized: Only administrators can fetch priority asset prices. This is an expensive operation reserved for system maintenance.");
    };
    await _refreshPriorityAssetPrices();
  };

  // Internal refresh for priority asset prices — no auth gate, called by the
  // recurring timer and by the admin-only fetchPriorityAssetPrices public
  // function. Uses the free api.coingecko.com simple/price endpoint (the
  // pro-api.coingecko.com host requires paid auth we do not have).
  private func _refreshPriorityAssetPrices() : async () {
    let baseAssetIds : [Text] = [
      "waterneuron",
      "rujira",
      "gold-dao",
      "openchat",
      "icpswap-token",
      "iclighthouse-dao",
      "origyn-foundation",
      "sonic-2",
      "internet-computer",
      "injective-protocol",
    ];

    // Concatenate the hardcoded base list with admin-added custom ids so the
    // priority rotation can grow beyond the fixed 10 tokens without touching
    // per_page on the markets endpoint.
    let allAssetIds : [Text] = Array.append(baseAssetIds, customPriorityAssetIds);

    // Maps each CoinGecko id (lowercase slug) to its proper uppercase ticker
    // symbol, matching how portfolios/transactions reference assets. The `id`
    // field stays the lowercase slug (used as the CoinGecko URL ids param and
    // the JSON path key "id.usd"); only the stored `symbol` uses the ticker.
    // Custom ids are resolved via customTickerMap (case-insensitive) before
    // falling back to the hardcoded switch, then to the id unchanged.
    let tickerFor : Text -> Text = func(id) {
      // Check customTickerMap first (case-insensitive linear scan).
      for ((cgId, ticker) in customTickerMap.vals()) {
        if (_textEqualIgnoreCase(cgId, id)) { return ticker };
      };
      switch (id) {
        case ("waterneuron") "WTN";
        case ("rujira") "RUJIRA";
        case ("gold-dao") "GOLD";
        case ("openchat") "OPENCHAT";
        case ("icpswap-token") "ICS";
        case ("iclighthouse-dao") "ICL";
        case ("origyn-foundation") "OGY";
        case ("sonic-2") "SONIC";
        case ("internet-computer") "ICP";
        case ("injective-protocol") "INJ";
        case (_) id;
      };
    };

    let idsParam = Array.foldLeft(
      allAssetIds,
      "",
      func(acc, id) {
        if (Text.size(acc) == 0) { id } else { acc # "," # id };
      },
    );

    let url = "https://api.coingecko.com/api/v3/simple/price?ids=" # idsParam # "&vs_currencies=usd";
    let response = try await OutCall.httpGetRequest(url, [], transform) catch (err) {
      // Outcall trapped (likely IC consensus / SysTransient). Do NOT clear the
      // existing priorityAssets map — preserve prior data and record the error.
      lastPriorityAssetsError := ?("_refreshPriorityAssetPrices: " # err.message());
      lastPriorityAssetsErrorTimestamp := ?Time.now();
      return;
    };

    let currentTime = Time.now();

    switch (Json.parse(response)) {
      case (#err(e)) {
        // Parse failed — leave priorityAssets untouched and record the error.
        lastPriorityAssetsError := ?("_refreshPriorityAssetPrices: JSON parse failed: " # Json.errToText(e));
        lastPriorityAssetsErrorTimestamp := ?currentTime;
        lastHealthCheck := currentTime;
        return;
      };
      case (#ok(json)) {
        // The simple/price response is an object keyed by priority id, each
        // value being { "usd": <price> }. Insert each asset under its OWN unique
        // incrementing Nat key (fixes the previous overwrite bug where every
        // asset was written with key 0).
        priorityAssets := natMap.empty<PriorityAsset>();
        var index : Nat = 0;
        // Per-id diagnostics: collect ids whose ".usd" path was not found in
        // the response (price == 0.0). We do NOT trap or skip storing — every
        // id is stored as before; this list is purely informational so the
        // debug panel can show which CoinGecko id had no price.
        var missingIds : [Text] = [];
        for (id in allAssetIds.vals()) {
          // Path "id.usd" resolves to the USD price for this priority id.
          let price = _getFloat(json, id # ".usd");
          if (price == 0.0) {
            missingIds := Array.append(missingIds, [id]);
          };
          priorityAssets := natMap.put(
            priorityAssets,
            index,
            {
              id;
              symbol = tickerFor(id);
              name = id;
              price;
              marketCap = 0.0; // simple/price endpoint does not return market cap
              lastUpdated = currentTime;
            },
          );
          index := index + 1;
        };
        if (missingIds.size() > 0) {
          // Build a comma-separated list of the ids that had no price. Inline
          // foldLeft join (no external join helper) inserts ", " between ids.
          let missingList = Array.foldLeft(
            missingIds,
            "",
            func(acc, id) {
              if (Text.size(acc) == 0) { id } else { acc # ", " # id };
            },
          );
          // Capture the first 300 chars of the raw response safely, clamping
          // to the actual response length so short responses do not trap.
          // Text has no direct slice/index, so materialize the chars once and
          // build the snippet from the first snippetLen of them.
          let responseChars = Text.toArray(response);
          let snippetLen = if (responseChars.size() < 300) { responseChars.size() } else { 300 };
          let snippet = Text.fromArray(Array.tabulate(snippetLen, func(i) { responseChars[i] }));
          lastPriorityAssetsError := ?(
            "Priority assets refreshed, but no price found for: " #
            missingList #
            ". Raw response snippet: " #
            snippet
          );
          lastPriorityAssetsErrorTimestamp := ?currentTime;
        } else {
          // All ids succeeded — clear any prior fetch error (existing behavior).
          lastPriorityAssetsError := null;
          lastPriorityAssetsErrorTimestamp := null;
        };
        lastHealthCheck := currentTime;
      };
    };
  };

  // Format an Int timestamp (nanoseconds since epoch) as a DD-MM-YYYY date
  // string for the CoinGecko /coins/{id}/history endpoint. CoinGecko expects
  // dd-mm-yyyy. We convert ns -> seconds -> days since 1970-01-01 and walk a
  // civil-calendar conversion (no Time/Date library dependency) to extract
  // day/month/year. Used by _fetchHistoricalPrice.
  private func _formatDateDDMMYYYY(timestamp : Int) : Text {
    // Whole seconds since epoch.
    let totalSeconds = timestamp / 1_000_000_000;
    // Whole days since 1970-01-01 (floor toward negative infinity for pre-1970).
    let daysSinceEpoch = totalSeconds / 86_400;
    // Use Float arithmetic for the civil-calendar conversion (Howard Hinnant
    // date algorithm). daysSinceEpoch is the count of days since 1970-01-01.
    let daysFloat = Float.fromInt(daysSinceEpoch);
    let z = daysFloat + 719468.0;
    let era = Float.nearest(Float.floor(z / 146097.0));
    let doe = z - era * 146097.0; // [0, 146096]
    let yoe = Float.nearest(Float.floor((doe - Float.nearest(Float.floor(doe / 1460.0)) + Float.nearest(Float.floor(doe / 36524.0)) - Float.nearest(Float.floor(doe / 146096.0))) / 365.0)); // [0, 399]
    let y = yoe + era * 400.0;
    let doy = doe - (365.0 * yoe + Float.nearest(Float.floor(yoe / 4.0)) - Float.nearest(Float.floor(yoe / 100.0))); // [0, 365]
    let mp = Float.nearest(Float.floor((5.0 * doy + 2.0) / 153.0)); // [0, 11]
    let d = doy - (153.0 * mp + 2.0) / 5.0 + 1.0; // [1, 31]
    let m = if (mp < 10.0) { mp + 3.0 } else { mp - 9.0 }; // [1, 12]
    let year = if (m <= 2.0) { y + 1.0 } else { y };
    let dayInt = Int.abs(Float.toInt(Float.nearest(d)));
    let monthInt = Int.abs(Float.toInt(Float.nearest(m)));
    let yearInt = Int.abs(Float.toInt(Float.nearest(year)));
    // Zero-pad day and month to 2 digits.
    let dayStr = if (dayInt < 10) { "0" # Int.toText(dayInt) } else { Int.toText(dayInt) };
    let monthStr = if (monthInt < 10) { "0" # Int.toText(monthInt) } else { Int.toText(monthInt) };
    let yearStr = Int.toText(yearInt);
    dayStr # "-" # monthStr # "-" # yearStr;
  };

  // Fetch the USD price of a CoinGecko asset at a historical date. Uses the
  // /coins/{id}/history endpoint with the same OutCall http-get pattern as the
  // other CoinGecko fetches in this file. Parses market_data.current_price.usd
  // from the transformed response. On ANY error (outcall trap, parse failure,
  // missing field), returns 0.0 — graceful degradation, never traps. This
  // matches the existing behavior where a missing/zero price falls back to the
  // current market price at the transaction-submission call site.
  private func _fetchHistoricalPrice(coinGeckoId : Text, date : Int) : async Float {
    try {
      let dateString = _formatDateDDMMYYYY(date);
      let url = "https://api.coingecko.com/api/v3/coins/" # coinGeckoId # "/history?date=" # dateString # "&localization=false";
      let response = await OutCall.httpGetRequest(url, [], transform);
      let json = switch (Json.parse(response)) {
        case (#err(_)) { return 0.0 };
        case (#ok(j)) { j };
      };
      // transform() canonicalizes /coins/{id}/history to {"market_data":
      // {"usd": <price>}} via _canonicalizeCoinHistory (the /history response
      // has no market_cap, which is how transform distinguishes it from
      // /coins/{id} detail). Extract the usd price.
      let price = _getFloat(json, "market_data.usd");
      price;
    } catch (_err) {
      0.0;
    };
  };

  public query ({ caller }) func getMarketData() : async [MarketData] {
    // Only authenticated users can view market data
    if (not (AccessControl.hasPermission(_acState, caller, #user))) {
      return [];
    };
    natMap.vals(marketData).toArray();
  };

  public query ({ caller }) func getPriorityAssets() : async [PriorityAsset] {
    // Only authenticated users can view priority assets
    if (not (AccessControl.hasPermission(_acState, caller, #user))) {
      return [];
    };
    natMap.vals(priorityAssets).toArray();
  };

  // Admin-only: search CoinGecko's /api/v3/search endpoint for tokens matching
  // the given query. Returns up to 10 {id, symbol, name} matches. On outcall
  // failure or parse failure, returns {results = []; error = ?"<message>"} so
  // the frontend can render a friendly "no results / search failed" state
  // instead of trapping. The transform() function already canonicalizes the
  // /search response to {"coins": [{"id":..,"symbol":..,"name":..}, ...]},
  // so we only need to walk that canonical shape here.
  public shared ({ caller }) func searchCoinGeckoTokens(searchQuery : Text) : async {
    results : [{ id : Text; symbol : Text; name : Text }];
    error : ?Text;
  } {
    if (not (AccessControl.hasPermission(_acState, caller, #admin))) {
      return { results = []; error = ?"Unauthorized: admin permission required" };
    };
    if (Text.size(searchQuery) == 0) {
      return { results = []; error = ?"Query must not be empty" };
    };
    let url = "https://api.coingecko.com/api/v3/search?query=" # searchQuery;
    let response = try await OutCall.httpGetRequest(url, [], transform) catch (err) {
      return { results = []; error = ?("searchCoinGeckoTokens: outcall failed: " # err.message()) };
    };
    let json = switch (Json.parse(response)) {
      case (#err(e)) {
        return { results = []; error = ?("searchCoinGeckoTokens: JSON parse failed: " # Json.errToText(e)) };
      };
      case (#ok(j)) { j };
    };
    // transform() canonicalizes /search to {"coins": [{id,symbol,name}, ...]}.
    // Other top-level keys (exchanges, categories, nfts) are dropped.
    let coins = switch (Json.get(json, "coins")) {
      case (?(#array(arr))) { arr };
      case _ { return { results = []; error = null } };
    };
    let results = Array.map(
      coins,
      func(coin) : { id : Text; symbol : Text; name : Text } {
        var id : Text = "";
        var symbol : Text = "";
        var name : Text = "";
        switch (coin) {
          case (#object_(entries)) {
            for ((k, v) in entries.vals()) {
              if (k == "id") {
                switch (v) { case (#string(s)) { id := s }; case _ {} };
              } else if (k == "symbol") {
                switch (v) { case (#string(s)) { symbol := s }; case _ {} };
              } else if (k == "name") {
                switch (v) { case (#string(s)) { name := s }; case _ {} };
              };
            };
          };
          case _ {};
        };
        { id; symbol; name };
      },
    );
    // Return up to the first 10 matches.
    let limit : Nat = 10;
    let count = if (results.size() < limit) { results.size() } else { limit };
    var trimmed = Array.init<{ id : Text; symbol : Text; name : Text }>(count, { id = ""; symbol = ""; name = "" });
    var i : Nat = 0;
    while (i < count) {
      trimmed[i] := results[i];
      i += 1;
    };
    { results = Array.freeze(trimmed); error = null };
  };

  // Admin-only: permanently add a CoinGecko token id to the priorityAssets
  // rotation. Validates inputs are non-empty, rejects duplicates (case-
  // insensitive on the id) against the 10 hardcoded base ids and the existing
  // customPriorityAssetIds, appends to customPriorityAssetIds and stores the
  // (coinGeckoId, tickerSymbol) pair in customTickerMap, then triggers an
  // immediate _refreshPriorityAssetPrices() so the new token's price is
  // fetched right away. Returns {success=true; error=null} on success, or
  // {success=false; error=?"<reason>"} on validation failure or duplicate.
  public shared ({ caller }) func addCustomPriorityAsset(coinGeckoId : Text, tickerSymbol : Text) : async {
    success : Bool;
    error : ?Text;
  } {
    if (not (AccessControl.hasPermission(_acState, caller, #admin))) {
      return { success = false; error = ?"Unauthorized: admin permission required" };
    };
    if (Text.size(coinGeckoId) == 0) {
      return { success = false; error = ?"coinGeckoId must not be empty" };
    };
    if (Text.size(tickerSymbol) == 0) {
      return { success = false; error = ?"tickerSymbol must not be empty" };
    };
    // Reject duplicates against the hardcoded base list (case-insensitive).
    let baseAssetIds : [Text] = [
      "waterneuron",
      "rujira",
      "gold-dao",
      "openchat",
      "icpswap-token",
      "iclighthouse-dao",
      "origyn-foundation",
      "sonic-2",
      "internet-computer",
      "injective-protocol",
    ];
    for (baseId in baseAssetIds.vals()) {
      if (_textEqualIgnoreCase(baseId, coinGeckoId)) {
        return { success = false; error = ?"coinGeckoId already in the base priority list" };
      };
    };
    // Reject duplicates against existing customPriorityAssetIds (case-insensitive).
    for (existingId in customPriorityAssetIds.vals()) {
      if (_textEqualIgnoreCase(existingId, coinGeckoId)) {
        return { success = false; error = ?"coinGeckoId already in customPriorityAssetIds" };
      };
    };
    // Append to customPriorityAssetIds and store the ticker mapping.
    customPriorityAssetIds := Array.append(customPriorityAssetIds, [coinGeckoId]);
    customTickerMap := Array.append(customTickerMap, [(coinGeckoId, tickerSymbol)]);
    // Trigger an immediate refresh so the new token's price is fetched now.
    try {
      await _refreshPriorityAssetPrices();
    } catch (err) {
      // The append already succeeded; the refresh failure is non-fatal because
      // the next scheduled refresh will pick up the new id. Surface the error
      // but report success since the asset was added.
      return { success = true; error = ?("Added, but refresh failed: " # err.message()) };
    };
    { success = true; error = null };
  };

  // Admin-only: remove a CoinGecko token id from the priorityAssets rotation.
  // Mirrors addCustomPriorityAsset's admin-gating and case-insensitive matching.
  // Filters the id out of customPriorityAssetIds and its ticker out of
  // customTickerMap, then triggers an immediate _refreshPriorityAssetPrices()
  // so the removed token's price is dropped from the stored map right away.
  // Returns {success=true; error=null} on success, or {success=false;
  // error=?"<reason>"} on auth failure or not-found.
  public shared ({ caller }) func removeCustomPriorityAsset(coinGeckoId : Text) : async {
    success : Bool;
    error : ?Text;
  } {
    if (not (AccessControl.hasPermission(_acState, caller, #admin))) {
      return { success = false; error = ?"Unauthorized: admin permission required" };
    };
    // Case-insensitive match against customPriorityAssetIds.
    var found = false;
    for (existingId in customPriorityAssetIds.vals()) {
      if (_textEqualIgnoreCase(existingId, coinGeckoId)) { found := true };
    };
    if (not found) {
      return { success = false; error = ?(coinGeckoId # " is not a custom priority asset") };
    };
    // Filter the id out of customPriorityAssetIds (case-insensitive).
    customPriorityAssetIds := Array.filter(
      customPriorityAssetIds,
      func(id) { not (_textEqualIgnoreCase(id, coinGeckoId)) },
    );
    // Filter its ticker entry out of customTickerMap (case-insensitive on the id).
    customTickerMap := Array.filter(
      customTickerMap,
      func((cgId, _ticker)) { not (_textEqualIgnoreCase(cgId, coinGeckoId)) },
    );
    // Trigger an immediate refresh so the removed token's price is dropped now.
    try {
      await _refreshPriorityAssetPrices();
    } catch (err) {
      // The removal already succeeded; the refresh failure is non-fatal because
      // the next scheduled refresh will pick up the removal. Surface the error
      // but report success since the asset was removed.
      return { success = true; error = ?("Removed, but refresh failed: " # err.message()) };
    };
    { success = true; error = null };
  };

  // Admin-only: returns the current customPriorityAssetIds paired with their
  // ticker (id, ticker) so the frontend can display what's already been added.
  // The ticker is resolved from customTickerMap (case-insensitive); if no
  // mapping is found, the id itself is used as the ticker fallback.
  public query ({ caller }) func getCustomPriorityAssets() : async [(Text, Text)] {
    if (not (AccessControl.hasPermission(_acState, caller, #admin))) {
      return [];
    };
    Array.map(
      customPriorityAssetIds,
      func(id) : (Text, Text) {
        var ticker : Text = id;
        for ((cgId, t) in customTickerMap.vals()) {
          if (_textEqualIgnoreCase(cgId, id)) { ticker := t };
        };
        (id, ticker);
      },
    );
  };

  // Public (any authenticated user): fetch the historical USD price of a
  // CoinGecko asset at a given date (Int nanoseconds since epoch). Delegates to
  // _fetchHistoricalPrice, which degrades gracefully to 0.0 on any error
  // rather than trapping. NOT admin-gated — any authenticated user can call it.
  public shared ({ caller }) func getHistoricalPrice(coinGeckoId : Text, date : Int) : async Float {
    if (not (AccessControl.hasPermission(_acState, caller, #user))) {
      return 0.0;
    };
    await _fetchHistoricalPrice(coinGeckoId, date);
  };

  public shared ({ caller }) func updateAssetPrices(portfolioId : Nat) : async () {
    // Verify ownership and authentication (done inside verifyPortfolioOwnership)
    let userPortfolios = verifyPortfolioOwnership(caller, portfolioId);

    let updatedPortfolios = Array.map(
      userPortfolios,
      func(p) {
        if (p.id == portfolioId) {
          let updatedAssets = Array.map(
            p.assets,
            func(asset) {
              let currentMarketPrice = getCurrentMarketPrice(asset.symbol);
              let newCurrentPrice = if (currentMarketPrice > 0.0) {
                currentMarketPrice;
              } else {
                asset.currentPrice;
              };

              let newCurrentValue = asset.amount * newCurrentPrice;

              let unrealizedPL = if (asset.amount > 0.0) {
                (newCurrentPrice - asset.averagePrice) * asset.amount;
              } else {
                0.0;
              };

              let totalProfitLoss = asset.realizedProfitLoss + unrealizedPL;

              // profitLossPercentage is unrealized-only: unrealizedPL / current purchaseValue * 100.
              // No 100% fallback for free tokens (purchaseValue == 0): a percentage
              // against a $0 cost basis is undefined, so return 0.0 here and let the
              // frontend render "—". Matches updateAssets() exactly.
              let profitLossPercentage = if (asset.purchaseValue > 0.0) {
                (unrealizedPL / asset.purchaseValue) * 100.0;
              } else {
                0.0;
              };

              // realizedProfitLossPercentage is recomputed from the carried-forward
              // totalSoldCost and realizedProfitLoss (both already stored on the asset).
              let realizedProfitLossPercentage = if (asset.totalSoldCost > 0.0) {
                (asset.realizedProfitLoss / asset.totalSoldCost) * 100.0;
              } else {
                0.0;
              };

              let averagePurchasePrice = if (asset.amount > 0.0) {
                asset.purchaseValue / asset.amount;
              } else {
                0.0;
              };

              {
                symbol = asset.symbol;
                name = asset.name;
                amount = asset.amount;
                averagePrice = asset.averagePrice;
                currentPrice = newCurrentPrice;
                profitLoss = totalProfitLoss;
                profitLossPercentage;
                purchaseValue = asset.purchaseValue;
                currentValue = newCurrentValue;
                realizedProfitLoss = asset.realizedProfitLoss;
                averagePurchasePrice;
                totalSoldCost = asset.totalSoldCost;
                realizedProfitLossPercentage;
              };
            },
          );

          let totalProfitLoss = calculateTotalProfitLoss(updatedAssets);
          let unrealizedProfitLoss = calculateUnrealizedProfitLoss(updatedAssets);

          {
            id = p.id;
            name = p.name;
            createdAt = p.createdAt;
            assets = updatedAssets;
            transactions = p.transactions;
            totalProfitLoss;
            unrealizedProfitLoss;
            totalPurchaseValue = p.totalPurchaseValue;
            trackedAssets = p.trackedAssets;
          };
        } else {
          p;
        };
      },
    );

    portfolios := principalMap.put(portfolios, caller, updatedPortfolios);
    lastHealthCheck := Time.now();
  };

  public query ({ caller }) func getPortfolioTransactions(portfolioId : Nat) : async [Transaction] {
    // Verify ownership and authentication (done inside verifyPortfolioOwnershipQuery)
    let userPortfolios = switch (verifyPortfolioOwnershipQuery(caller, portfolioId)) {
      case null { return [] };
      case (?p) { p };
    };

    let portfolio = Array.find(
      userPortfolios,
      func(p) { p.id == portfolioId },
    );

    switch (portfolio) {
      case null { [] };
      case (?p) { p.transactions };
    };
  };

  public query ({ caller }) func getPortfolioAssets(portfolioId : Nat) : async [Asset] {
    // Verify ownership and authentication (done inside verifyPortfolioOwnershipQuery)
    let userPortfolios = switch (verifyPortfolioOwnershipQuery(caller, portfolioId)) {
      case null { return [] };
      case (?p) { p };
    };

    let portfolio = Array.find(
      userPortfolios,
      func(p) { p.id == portfolioId },
    );

    switch (portfolio) {
      case null { [] };
      case (?p) { p.assets };
    };
  };

  public query ({ caller }) func getPortfolioSummary(portfolioId : Nat) : async ?{
    totalValue : Float;
    totalProfitLoss : Float;
    unrealizedProfitLoss : Float;
    totalPurchaseValue : Float;
  } {
    // Verify ownership and authentication (done inside verifyPortfolioOwnershipQuery)
    let userPortfolios = switch (verifyPortfolioOwnershipQuery(caller, portfolioId)) {
      case null { return null };
      case (?p) { p };
    };

    let portfolio = Array.find(
      userPortfolios,
      func(p) { p.id == portfolioId },
    );

    switch (portfolio) {
      case null { null };
      case (?p) {
        let totalValue = Array.foldLeft(
          p.assets,
          0.0,
          func(acc, asset) {
            if (asset.amount >= 0.0 and asset.currentPrice >= 0.0) {
              acc + (asset.amount * asset.currentPrice);
            } else {
              acc;
            };
          },
        );

        ?{
          totalValue;
          totalProfitLoss = p.totalProfitLoss;
          unrealizedProfitLoss = p.unrealizedProfitLoss;
          totalPurchaseValue = p.totalPurchaseValue;
        };
      };
    };
  };

  public query ({ caller }) func getPortfolioTrackedAssets(portfolioId : Nat) : async [Text] {
    // Verify ownership and authentication (done inside verifyPortfolioOwnershipQuery)
    let userPortfolios = switch (verifyPortfolioOwnershipQuery(caller, portfolioId)) {
      case null { return [] };
      case (?p) { p };
    };

    let portfolio = Array.find(
      userPortfolios,
      func(p) { p.id == portfolioId },
    );

    switch (portfolio) {
      case null { [] };
      case (?p) { p.trackedAssets };
    };
  };

  public query ({ caller }) func getAvailableAssets() : async [Text] {
    // Only authenticated users can view available assets
    if (not (AccessControl.hasPermission(_acState, caller, #user))) {
      return [];
    };

    let marketDataArray = natMap.vals(marketData).toArray();
    let availableAssets = Array.map(
      marketDataArray,
      func(md) { md.symbol },
    );

    let priorityAssets : [Text] = [
      "waterneuron",
      "rujira",
      "gold-dao",
      "openchat",
      "icpswap-token",
      "iclighthouse-dao",
      "origyn-foundation",
      "sonic-2",
      "internet-computer",
      "injective-protocol",
    ];

    let combinedAssets = Array.append(availableAssets, priorityAssets);

    var uniqueAssets : [Text] = [];
    for (asset in combinedAssets.vals()) {
      let exists = Array.find(
        uniqueAssets,
        func(a) { a == asset },
      );
      switch (exists) {
        case null {
          uniqueAssets := Array.append(uniqueAssets, [asset]);
        };
        case (?_) {};
      };
    };

    uniqueAssets;
  };

  // Admin-only function to fetch historical price data
  // This is restricted to admins because it triggers HTTP outcalls
  public shared ({ caller }) func fetchHistoricalPriceData(assetId : Text) : async Text {
    // Only admins can fetch historical price data (expensive operation)
    if (not (AccessControl.hasPermission(_acState, caller, #admin))) {
      Debug.trap("Unauthorized: Only administrators can fetch historical price data. This is an expensive operation reserved for system maintenance.");
    };

    let url = "https://api.coingecko.com/api/v3/coins/" # assetId # "/market_chart?vs_currency=usd&days=30";
    let response = await OutCall.httpGetRequest(url, [], transform);

    // Return the raw JSON response as text
    response;
  };

  // Admin-only function to fetch technical data
  // This is restricted to admins because it triggers HTTP outcalls
  public shared ({ caller }) func fetchTechnicalData(assetId : Text) : async () {
    // Only admins can fetch technical data (expensive operation)
    if (not (AccessControl.hasPermission(_acState, caller, #admin))) {
      Debug.trap("Unauthorized: Only administrators can fetch technical data. This is an expensive operation reserved for system maintenance.");
    };

    let url = "https://api.coingecko.com/api/v3/coins/" # assetId;
    let response = try await OutCall.httpGetRequest(url, [], transform) catch (err) {
      // Outcall trapped (likely IC consensus / SysTransient). Do NOT overwrite
      // existing technicalData — preserve prior data and record the error.
      lastTechnicalDataError := ?("fetchTechnicalData(" # assetId # "): " # err.message());
      lastTechnicalDataErrorTimestamp := ?Time.now();
      return;
    };

    // Parse the CoinGecko coin response and store real values instead of
    // hardcoded zeros. The coin object exposes:
    //   market_data.current_price.usd
    //   market_data.market_cap.usd
    //   market_data.price_change_percentage_24h
    //   market_data.total_volume.usd
    let currentTime = Time.now();
    var currentPrice : Float = 0.0;
    var marketCap : Float = 0.0;
    var change24h : Float = 0.0;
    var volume24h : Float = 0.0;
    var symbol : Text = assetId;
    var name : Text = assetId;

    switch (Json.parse(response)) {
      case (#err(e)) {
        // Parse failed — record the error and keep the zero defaults. Do NOT
        // overwrite technicalData with zeros; leave prior data intact.
        lastTechnicalDataError := ?("fetchTechnicalData(" # assetId # "): JSON parse failed: " # Json.errToText(e));
        lastTechnicalDataErrorTimestamp := ?currentTime;
        lastHealthCheck := currentTime;
        return;
      };
      case (#ok(json)) {
        currentPrice := _getFloat(json, "market_data.current_price.usd");
        marketCap := _getFloat(json, "market_data.market_cap.usd");
        change24h := _getFloat(json, "market_data.price_change_percentage_24h");
        volume24h := _getFloat(json, "market_data.total_volume.usd");
        let symbolText = _getText(json, "symbol");
        let nameText = _getText(json, "name");
        if (Text.size(symbolText) > 0) { symbol := symbolText };
        if (Text.size(nameText) > 0) { name := nameText };
        lastHealthCheck := currentTime;
      };
    };

    technicalData := natMap.put(
      technicalData,
      0,
      {
        symbol;
        name;
        currentPrice;
        marketCap;
        change24h;
        volume24h;
        lastUpdated = currentTime;
      },
    );
  };

  public query ({ caller }) func getTechnicalData(assetId : Text) : async ?TechnicalData {
    // Only authenticated users can view technical data
    if (not (AccessControl.hasPermission(_acState, caller, #user))) {
      return null;
    };

    let technicalDataArray = natMap.vals(technicalData).toArray();
    Array.find(
      technicalDataArray,
      func(td) { Text.equal(td.symbol, assetId) },
    );
  };

  public query ({ caller }) func getMarketDataStatus() : async ?MarketDataStatus {
    // Only authenticated users can view market data status
    if (not (AccessControl.hasPermission(_acState, caller, #user))) {
      return null;
    };

    let statusArray = natMap.vals(marketDataStatus).toArray();
    if (statusArray.size() > 0) {
      ?statusArray[0];
    } else {
      null;
    };
  };

  // User can only update their own market data status (scoped to their session)
  // This is safe because each user's status is independent
  public shared ({ caller }) func updateMarketDataStatus(status : MarketDataStatus) : async () {
    // Only authenticated users can update their market data status
    if (not (AccessControl.hasPermission(_acState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can update market data status. Please authenticate with Internet Identity and try again.");
    };

    // Note: In a production system, this should be scoped per-user rather than global
    // For now, we allow authenticated users to update the global status
    marketDataStatus := natMap.put(marketDataStatus, 0, status);
    lastHealthCheck := Time.now();
  };

  // Scheduled background refresh — called by the recurring timer below.
  // Awaits the internal (no-auth-gate) refresh helpers for market data and
  // priority asset prices so the canister stays warm without an admin trigger.
  private func _scheduledRefresh() : async () {
    await _refreshMarketData();
    await _refreshPriorityAssetPrices();
  };

  // One-time timer: fire _scheduledRefresh once ~5 seconds after actor start
  // so marketData/priorityAssets aren't empty right after a fresh deploy, with
  // no recurring cost afterward. The timer ID is transient state — timer IDs
  // are not stable across upgrades, so the timer is re-registered on every
  // (re)start.
  transient let _refreshTimerId : Timer.TimerId = Timer.setTimer(
    #nanoseconds(5_000_000_000),
    _scheduledRefresh,
  );

  // One-time data migration: recompute totalPurchaseValue for every existing
  // portfolio using the already-correct calculateTotalPurchaseValue(assets)
  // function. Brings stored values in sync with the fixed calculation logic
  // without requiring any user transaction to trigger. Idempotent via the
  // migrationVersion guard — runs only on the first upgrade that sees
  // migrationVersion < 1.
  system func postupgrade() {
    if (migrationVersion < 1) {
      portfolios := principalMap.map(
        portfolios,
        func(_principal, userPortfolios) {
          Array.map(
            userPortfolios,
            func(p) {
              { p with totalPurchaseValue = calculateTotalPurchaseValue(p.assets) }
            },
          )
        },
      );
      migrationVersion := 1;
    };
  };
};

