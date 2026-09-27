# Project Guidance

## User Preferences

- Profit and loss figures must be consistent across summary cards, per-asset table, and chart
- Backend canonical P&L fields are authoritative; frontend must not recompute them
- USD is the primary/default currency display
- Every monetary value automatically shows its PLN equivalent beneath the USD value; no currency toggle

## Verified Commands

- **typecheck**: `pnpm typecheck`
- **fix**: `pnpm fix`
- **build**: `pnpm build`

## Learnings

- Unrealized P/L percentage must divide by the same cost basis the dollar unrealized uses (averagePrice * amount); purchaseValue is scaled on sells while averagePrice is not, so it drifts from the dollar figure.
- Asset.profitLossPercentage is a stored field recomputed only on mutations (addTransaction/updateAssets, updateAssetPrices); a formula change leaves existing stored assets stale until a transaction or price refresh, so a one-time recompute must be added as a new Enhanced Migration chain entry.
- In this converted legacy->enhanced project, mops build emits MOPS-CHECK-DEPLOY-SKIPPED with M0263 errors because the chain's first migration has a non-empty OldActor (pre-conversion shape); this is expected and pre-existing, the build still succeeds and mops check --fix passes the stable compatibility check.
- The deployed stable shape uses mo:base/OrderedMap.Map for map fields, so a new migration's OldActor/NewActor must use OrderedMap.Map and derive OldActor from the preceding migration's NewActor.
- The canonical unrealized-only profitLossPercentage formula is (currentPrice - averagePrice) * amount / (averagePrice * amount) * 100, with 0.0 when averagePrice * amount is 0; it matches both updateAssets and updateAssetPrices.
- updatePortfolioWithMarketPrices overlays live market prices onto asset.currentPrice for display; it must also recompute the displayed profitLossPercentage from that same overlaid currentPrice with the canonical unrealized-only formula, or the table shows a fresh price next to a stale percentage.
- A migration entry that has already run on the deployed canister will not re-run, so repairing the same derived field again requires a NEW timestamped chain entry whose OldActor equals the preceding entry's NewActor.
- The canonical unrealized-only profitLossPercentage formula is (currentPrice - averagePrice) * amount / (averagePrice * amount) * 100, with 0.0 when averagePrice * amount is 0; it matches updateAssets, updateAssetPrices, and the migration recompute.
- Summary cards must read backend-canonical portfolio.totalPurchaseValue/unrealizedProfitLoss/totalProfitLoss directly and derive totalValue as totalPurchaseValue + unrealizedProfitLoss, so the identity 'total value - total purchase value = unrealized P/L' holds exactly even with sell history.
- The backend's unrealized basis (averagePrice*amount) differs from the sell-scaled purchaseValue basis, so the two are not interchangeable and the value-minus-cost identity only holds when totalValue is derived from the canonical fields.
- The USD->PLN rate is fetched from https://open.er-api.com/v6/latest/USD via a backend outcall, cached in the exchangeRate stable var, and refreshed alongside prices; getExchangeRate returns ?ExchangeRate and refreshExchangeRate returns ExchangeRate.
- The IC invokes the actor's transform callback as a plain query function which cannot await; a lib helper it delegates to must be synchronous, and an include Mixin(...) receiving the transform callback must be placed after transform and all its helpers.
- OQL Entity.manual over a single-row record works with an iterator built from a one-element array; an optional field on an OQL manual entity must be flattened to a concrete Value with a sentinel.
- Recharts SVG inline labels cannot render a React component, so a two-line USD/PLN label must be built from formatMoney as stacked <tspan> elements.
- CurrencyProvider wraps the app and is fed by a CurrencyRateProvider wrapper inside QueryClientProvider calling useGetExchangeRate; formatPln returns null when the rate is missing or non-positive so <Money> omits the PLN line and renders USD only with no crash.
- Visual QA cannot reach the dashboard in headless runs because the app is gated behind Internet Identity; VITE_USE_MOCK only swaps the backend actor, not the auth identity.
- The canonical cost basis is averagePrice * amount; asset.purchaseValue must always equal averagePrice * amount (never sell-scaled), so totalPurchaseValue shares one basis with unrealizedProfitLoss.
- All four portfolio totals must sum the per-asset fields over the same asset set (amount > 0) so the identities totalValue - totalPurchaseValue == unrealizedProfitLoss and totalProfitLoss == realized + unrealized hold exactly; Portfolio.totalValue is stored on the backend, not derived by the frontend.
- The frontend table must filter assets with amount > 0 to match the backend's amount > 0 asset set, or the column sums fall short of the cards.
- updatePortfolioWithMarketPrices must overlay only currentPrice and profitLossPercentage; overwriting asset.profitLoss/purchaseValue or portfolio totals desyncs the table from the canonical cards.
- An OQL Entity field mapper chain requires exactly one Entity.payload(...) wrapper per field mapper; with N fields and N-1 payloads the last mapper binds to the enclosing Entity.ownedBy and the compiler reports M0098.
- After a backend field addition, the frontend mock backend (src/mocks/backend.ts) Portfolio literal must also gain the new required field or pnpm typecheck fails with TS2741.
- A migration that adds a record field to a nested array element must inline both old and new element types and map over the outer OrderedMap and the inner array; OldActor must equal the preceding entry's NewActor.
- updatePortfolioWithMarketPrices must recompute per-asset profitLoss = realizedProfitLoss + unrealizedPL and the portfolio totals totalValue/unrealizedProfitLoss/totalProfitLoss over the amount > 0 asset set, or live prices desync the table from the summary cards.
- totalPurchaseValue is price-independent and must be left unchanged when overlaying live market prices; only totalValue, unrealizedProfitLoss, and totalProfitLoss are recomputed.
