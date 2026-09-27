// Static, human-readable documentation of the backend's public API.
//
// This mixin declares exactly one method, `getApiDoc`, and reads no actor
// state. The Markdown is a literal returned directly from the function body —
// it is never bound to a top-level `let`, because every top-level binding in a
// mixin is stable state and would trap at runtime.
mixin () {
  public query func getApiDoc() : async Text {
    "# Portfolio Backend API\n" #
    "\n" #
    "Motoko canister for a crypto portfolio tracker. It stores per-user profiles and portfolios (with transactions and derived asset positions), caches CoinGecko market data, and exposes an OQL query surface. All monetary values are USD. All timestamps are Int nanoseconds since the Unix epoch (`Time.now()`).\n" #
    "\n" #
    "## Authentication and identity\n" #
    "\n" #
    "The canister uses Internet Identity plus the Caffeine authorization component. Call `initializeAccessControl()` once as a signed-in caller to register: the first caller becomes admin, every later caller becomes a regular user. A caller that never signed in through the app's frontend is unregistered, even if it belongs to the app owner; a principal derived against a different derivation origin is a different principal than the one the frontend registered. The frontend pins an Internet Identity derivation origin, published at `/.well-known/ii-derivation-origin` when available; an agent already holding the user's Internet Identity authorization derives the correct per-app principal against that origin (for example `icp identity link web <name> --app <host>`). Such a delegation acts with the user's full authority in this app until it expires.\n" #
    "\n" #
    "Guarded endpoints return empty values or an error variant for an unregistered or anonymous caller; admin-gated endpoints trap with `Unauthorized: ...` (see each method below).\n" #
    "\n" #
    "`isCallerAdmin() : async Bool` is the one exception: it never traps. It returns `false` for an anonymous caller and for a signed-in caller that has not registered yet, and `true` only for a caller whose stored role is `#admin`. Use it to decide whether to show admin controls; a `false` result means \"not admin\", not \"error\".\n" #
    "\n" #
    "## Types\n" #
    "\n" #
    "- `UserProfile { name; theme; language; colorScheme }` — `theme` is `\"light\"` or `\"dark\"`; `language` is `\"pl\"` or `\"en\"`; `colorScheme` is `\"default\"`, `\"gray\"`, or `\"navy\"`.\n" #
    "- `Transaction { id; assetSymbol; assetName; amount; price; type_; date; comment }` — `type_` is `\"buy\"` or `\"sell\"`; `date` is nanoseconds; `amount` and `price` are USD-denominated Floats.\n" #
    "- `Asset { symbol; name; amount; averagePrice; currentPrice; profitLoss; profitLossPercentage; purchaseValue; currentValue; realizedProfitLoss; averagePurchasePrice; totalSoldCost; realizedProfitLossPercentage }` — derived from transactions; percentages are 0–100 scale. `purchaseValue` is the canonical cost basis `averagePrice * amount` (never sell-scaled), so it shares one basis with the unrealized P/L. `profitLoss` is `realizedProfitLoss + (currentPrice - averagePrice) * amount`. `profitLossPercentage` is unrealized-only: `(currentPrice - averagePrice) * amount / (averagePrice * amount) * 100`, the same cost basis the dollar unrealized uses; it is 0.0 when that cost basis is 0 (a percentage against a $0 cost basis is undefined). `realizedProfitLossPercentage` is `realizedProfitLoss / totalSoldCost * 100`.\n" #
    "- `Portfolio { id; name; createdAt; assets; transactions; totalProfitLoss; unrealizedProfitLoss; totalPurchaseValue; totalValue; trackedAssets }` — the four totals are canonical sums of the per-asset fields over assets with `amount > 0`: `totalPurchaseValue = sum(purchaseValue)`, `unrealizedProfitLoss = sum((currentPrice - averagePrice) * amount)`, `totalProfitLoss = sum(profitLoss)`, `totalValue = sum(amount * currentPrice)`. Because all four share the same asset set and `purchaseValue == averagePrice * amount`, the identities `totalValue - totalPurchaseValue == unrealizedProfitLoss` and `totalProfitLoss == realized + unrealized` hold exactly.\n" #
    "- `MarketData { id; symbol; name; price; marketCap; lastUpdated }` — `id` is the insertion index, not a stable identity.\n" #
    "- `PriorityAsset { id; symbol; name; price; marketCap; lastUpdated }` — `id` is the CoinGecko slug; `symbol` is the ticker; `marketCap` is always 0.0 (the simple/price endpoint does not return it).\n" #
    "- `TechnicalData { symbol; name; currentPrice; marketCap; change24h; volume24h; lastUpdated }`.\n" #
    "- `MarketDataStatus { status; lastUpdated; calculationQuality; trackedAssetsCount; apiHealth; colorScheme }`.\n" #
    "- `RefreshResult { marketDataOk; marketDataError; priorityAssetsOk; priorityAssetsError }`.\n" #
    "- `ExchangeRate { rate; lastUpdated; sourceTimestamp; lastError }` — `rate` is PLN per 1 USD; `lastUpdated` and `sourceTimestamp` are Int nanoseconds; `lastError` is null on the last successful fetch.\n" #
    "- `AuthResult<T> = #ok(T) | #unauthorized(Text) | #notFound(Text)`.\n" #
    "\n" #
    "## Auth and profile methods\n" #
    "\n" #
    "- `initializeAccessControl() : async ()` — registers the caller. First caller becomes admin, later callers become users. Idempotent per caller; also rebuilds the access-control state if it is unpopulated.\n" #
    "- `isCallerAdmin() : async Bool` — query; true only when the caller's stored role is `#admin`. Never traps: anonymous and unregistered callers get `false`.\n" #
    "- `isAuthenticated() : async Bool` — query; true when the caller holds at least the `#user` role.\n" #
    "- `getCallerUserProfile() : async ?UserProfile` — query; the caller's own profile, or null when unauthenticated or absent.\n" #
    "- `getCallerUserProfileWithStatus() : async AuthResult<UserProfile>` — query; distinguishes `#unauthorized`, `#notFound`, and `#ok`.\n" #
    "- `getUserProfile(user : Principal) : async ?UserProfile` — query; the caller may read only their own profile unless they are admin; otherwise null.\n" #
    "- `saveCallerUserProfile(profile : UserProfile) : async ()` — upsert the caller's profile. Traps for unauthenticated callers.\n" #
    "- `getSystemHealth() : async { isHealthy; lastCheck; currentTime }` — query; admin-only, traps otherwise.\n" #
    "\n" #
    "## Portfolio methods\n" #
    "\n" #
    "- `createPortfolio(name : Text) : async Nat` — creates a portfolio and returns its id. Traps when unauthenticated or when the caller already has 10 portfolios. Ids are the array index at creation time, so deleting a portfolio can make a later id collide with an existing one.\n" #
    "- `deletePortfolio(portfolioId : Nat) : async ()` — removes the caller's portfolio. Traps when unauthenticated or when the id is not owned by the caller.\n" #
    "- `getPortfolios() : async [Portfolio]` — query; the caller's portfolios, or `[]` when unauthenticated.\n" #
    "- `getPortfoliosWithStatus() : async AuthResult<[Portfolio]>` — query; `#unauthorized` for unauthenticated callers, otherwise `#ok` (an empty list is valid).\n" #
    "- `addTransaction(portfolioId : Nat, transaction : Transaction) : async ()` — appends a transaction and recomputes assets. Traps on invalid data (non-positive amount, negative price, empty symbol/name, type other than buy/sell), on a sell larger than current holdings, and on missing ownership.\n" #
    "- `editTransaction(portfolioId : Nat, transactionId : Nat, updatedTransaction : Transaction) : async ()` — replaces a transaction and recomputes assets from scratch. Traps on invalid data, unknown transaction id, or missing ownership.\n" #
    "- `deleteTransaction(portfolioId : Nat, transactionId : Nat) : async ()` — removes a transaction and recomputes assets. Traps on unknown transaction id or missing ownership.\n" #
    "- `updateAssetPrices(portfolioId : Nat) : async ()` — re-prices the portfolio's assets from the cached market data. Traps on missing ownership.\n" #
    "- `getPortfolioTransactions(portfolioId : Nat) : async [Transaction]` — query; `[]` when unauthenticated or not owned.\n" #
    "- `getPortfolioAssets(portfolioId : Nat) : async [Asset]` — query; `[]` when unauthenticated or not owned.\n" #
    "- `getPortfolioSummary(portfolioId : Nat) : async ?{ totalValue; totalProfitLoss; unrealizedProfitLoss; totalPurchaseValue }` — query; null when unauthenticated or not owned. All four values are the stored canonical portfolio totals (sums of the per-asset fields over assets with `amount > 0`), not recomputed at read time.\n" #
    "- `getPortfolioTrackedAssets(portfolioId : Nat) : async [Text]` — query; `[]` when unauthenticated or not owned.\n" #
    "- `getAvailableAssets() : async [Text]` — query; deduplicated symbols from cached market data plus the hardcoded priority list; `[]` when unauthenticated.\n" #
    "\n" #
    "## Market data methods\n" #
    "\n" #
    "- `fetchMarketData() : async ()` — any authenticated user; refreshes the top-40 CoinGecko markets list. Traps for anonymous callers.\n" #
    "- `fetchPriorityAssetPrices() : async ()` — any authenticated user; refreshes the priority-asset prices. Traps for anonymous callers.\n" #
    "- `refreshAllPrices() : async RefreshResult` — any authenticated user; runs both refreshes and reports each half's outcome. Traps for anonymous callers, but never traps for outcall or parse failures: each half is trap-guarded and reports `ok=false` with the recorded error text instead.\n" #
    "- `getMarketData() : async [MarketData]` — query; `[]` when unauthenticated.\n" #
    "- `getPriorityAssets() : async [PriorityAsset]` — query; `[]` when unauthenticated.\n" #
    "- `getMarketDataStatus() : async ?MarketDataStatus` — query; null when unauthenticated or unset.\n" #
    "- `updateMarketDataStatus(status : MarketDataStatus) : async ()` — stores the single global status row (key 0). Traps for unauthenticated callers. The row is global, not per-user.\n" #
    "- `getTechnicalData(assetId : Text) : async ?TechnicalData` — query; matches on `symbol`; null when unauthenticated or absent.\n" #
    "- `fetchTechnicalData(assetId : Text) : async ()` — admin-only; fetches and stores technical data under key 0. Traps for non-admins; outcall/parse failures are recorded and leave prior data intact.\n" #
    "- `fetchHistoricalPriceData(assetId : Text) : async Text` — admin-only; returns the raw 30-day market-chart JSON as text. Traps for non-admins.\n" #
    "- `getHistoricalPrice(coinGeckoId : Text, date : Int) : async Float` — any authenticated user; returns the USD price at `date` (nanoseconds), or 0.0 on any error or when unauthenticated. Never traps.\n" #
    "- `searchCoinGeckoTokens(searchQuery : Text) : async { results : [{ id; symbol; name }]; error : ?Text }` — admin-only; returns up to 10 matches. Non-admins and empty queries get `results = []` with an `error` message rather than a trap.\n" #
    "- `addCustomPriorityAsset(coinGeckoId : Text, tickerSymbol : Text) : async { success : Bool; error : ?Text }` — admin-only; appends a custom id and triggers an immediate refresh. Rejects empty inputs and duplicates (case-insensitive) against the base list and existing custom ids. A refresh failure still reports `success = true` with an error message.\n" #
    "- `removeCustomPriorityAsset(coinGeckoId : Text) : async { success : Bool; error : ?Text }` — admin-only; removes a custom id (case-insensitive) and triggers an immediate refresh. A refresh failure still reports `success = true` with an error message.\n" #
    "- `getCustomPriorityAssets() : async [(Text, Text)]` — query; admin-only; returns `(coinGeckoId, ticker)` pairs, or `[]` for non-admins.\n" #
    "\n" #
    "## Exchange-rate methods\n" #
    "\n" #
    "The USD -> PLN rate is a display-layer conversion factor only: every stored monetary value stays USD-denominated, and the frontend multiplies by this rate to render the PLN equivalent beneath each USD value. No P&L or cost-basis calculation reads it.\n" #
    "\n" #
    "- `getExchangeRate() : async ?ExchangeRate` — query; any authenticated user. Returns the cached rate plus provenance, or null for an unauthenticated caller or when no rate has ever been cached. `ExchangeRate { rate; lastUpdated; sourceTimestamp; lastError }`: `rate` is PLN per 1 USD; `lastUpdated` is the Int nanosecond timestamp of the last fetch attempt; `sourceTimestamp` is the provider's `time_last_update_unix` converted to nanoseconds (0 when absent); `lastError` is null on the most recent successful fetch, or the recorded failure text when the last fetch failed (in which case `rate` still holds the last successfully cached value).\n" #
    "- `refreshExchangeRate() : async ExchangeRate` — any authenticated user; fetches the current rate from `https://open.er-api.com/v6/latest/USD` and caches it. Traps for anonymous callers, but never traps on network or parse failure: the failure is recorded in the returned record's `lastError` and the previously cached rate is preserved. Also refreshed automatically by `refreshAllPrices()` and by the one-shot startup timer.\n" #
    "\n" #
    "## Error reporting\n" #
    "\n" #
    "Each refresh function owns its own error pair so a later success cannot erase an earlier failure. `getLastFetchError()` is readable by any authenticated user and returns `{ marketData; priorityAssets; technicalData }`, where each field is null when that function has no recorded error or `?{ error; timestamp }` when it does. `refreshAllPrices()` surfaces the same market-data and priority-asset errors inline in its `RefreshResult`.\n" #
    "\n" #
    "The priority-assets path is a special case: when CoinGecko returns no price for one or more ids, the rows are still stored (with `price = 0.0`) and the missing ids are reported through `lastPriorityAssetsError`, so `priorityAssetsOk` is false even though data was written.\n" #
    "\n" #
    "## Lifecycle and polling\n" #
    "\n" #
    "A one-shot timer fires about 5 seconds after every actor (re)start and runs both refreshes once; there is no recurring refresh. The timer id is transient and is re-registered on each start. Market data therefore goes stale between restarts and user-triggered refreshes; poll `getMarketData()` / `getPriorityAssets()` and compare `lastUpdated` against the current time rather than assuming freshness. `refreshAllPrices()` is the safe way to force an update and learn whether it worked.\n" #
    "\n" #
    "## Mutation retry safety\n" #
    "\n" #
    "`createPortfolio`, `addTransaction`, `editTransaction`, `deleteTransaction`, and `updateAssetPrices` are not idempotent: retrying a call that actually succeeded duplicates the effect (a second portfolio, a second transaction). `editTransaction` and `deleteTransaction` are safe to retry only because they target an existing id. `saveCallerUserProfile` and `updateMarketDataStatus` are upserts and safe to retry. `addCustomPriorityAsset` / `removeCustomPriorityAsset` reject duplicates, so a retry after a successful add returns an error rather than adding twice.\n" #
    "\n" #
    "## OQL\n" #
    "\n" #
    "`schema()` and `execute()` expose nine entities for the Caffeine Data Intelligence agent: `userProfile` and `portfolio` are scoped to the caller (a non-controller sees only its own rows), while `marketData`, `priorityAsset`, `technicalData`, `marketDataStatus`, `customPriorityAssetId`, `customTicker`, and `exchangeRate` are controller-only.\n" #
    "\n" #
    "The `exchangeRate` entity is a single row holding the cached USD -> PLN display rate: `rate` (PLN per 1 USD), `lastUpdated` and `sourceTimestamp` (Int nanoseconds), and `lastError` (the recorded failure text, or `\"\"` when the last fetch succeeded — the option is flattened to Text with the empty string as the null sentinel).\n" #
    "\n" #
    "## Gotchas\n" #
    "\n" #
    "- `refreshAllPrices()` never traps on network failure; check `marketDataOk` / `priorityAssetsOk` and the error fields instead of relying on a rejected promise.\n" #
    "- `getHistoricalPrice` returns 0.0 for both \"no data\" and \"request failed\"; 0.0 is not a reliable price.\n" #
    "- `getMarketData` / `getPriorityAssets` return `[]` for unauthenticated callers, which is indistinguishable from \"no data cached yet\".\n" #
    "- `fetchHistoricalPriceData` returns the raw CoinGecko JSON, not a parsed structure.\n" #
    "- `getSystemHealth` traps for non-admins rather than returning an error value; `getLastFetchError` traps only for anonymous callers.\n" #
    "- Portfolio ids are array indices, so deleting a portfolio can cause a later `createPortfolio` to reuse an id.\n";
  };
};
