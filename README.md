# Macro Liquidity Dashboard (Next.js)

Dark-mode macro dashboard to classify market regime from liquidity, rates, dollar, oil, and equities.

## Quick start

1. Install dependencies:
   - `npm install`
2. Configure server env:
   - `FRED_API_KEY=...`
   - Optional `ALLOW_MOCK_FRED=true` for local fixture mode
   - Optional `MARKET_DATA_SOURCE=yahoo` (default), `stooq`, or `mock`
   - Copy `.env.example` to `.env.local` and fill values
3. Run app:
   - `npm run dev`
4. Open:
   - `http://localhost:3000/dashboard`

## Dashboard controls

- Refresh button:
  - Forces a fresh dashboard request from the client.
- Preset range bar:
  - `4W`, `13W`, `26W`, `1Y`, `2Y`, `ALL` quick range selectors.
- Date range filters:
  - `Custom Range` opens native date pickers in the top toolbar.
  - Sends `startDate` and `endDate` as `YYYY-MM-DD` query params to `/api/dashboard`.
  - Metrics/regime are computed on the filtered aligned series.
- Reset button:
  - Use `ALL` preset to clear date filters and return to full history.

## Architecture

- `app/api/dashboard/route.ts`
  - Server-only route handler that fetches providers, computes derived metrics, and returns dashboard payload.
  - Uses Zod for threshold and date-range query validation and returns graceful 4xx/5xx responses.
- `src/lib/providers/fred.ts`
  - Direct FRED ingestion for macro series.
  - Validates external payload shape with Zod.
  - Caches each series in memory for 15 minutes.
- `src/lib/providers/market/*`
  - Provider abstraction (`MarketDataProvider`) plus adapters.
  - `yahoo` adapter as default public market data source.
  - `stooq` adapter as fallback source.
  - `mock` adapter for deterministic local development.
- `src/lib/calculations/*`
  - Weekly as-of alignment with explicit staleness rules.
  - Derived metrics and rolling window changes.
- `src/lib/regime/classifier.ts`
  - Transparent threshold-based regime logic (no ML).

## Data series (anchored names)

FRED:
- `WALCL`
- `WTREGEN`
- `RRPONTSYD`
- `M2SL`
- `FEDFUNDS`
- `DGS2`
- `DGS10`

Market adapter keys:
- `SPX`
- `DXY`
- `WTI`
- `BTC`

## Formulas and units

- `netLiquidity = WALCL - WTREGEN - RRPONTSYD`
  - Units: millions USD (matches FRED source series units)
- `liquidityVsSPX = netLiquidity / SPX`
  - Units: million-USD per SPX index point
- 4w and 13w changes:
  - Computed on aligned weekly series
  - `absolute = latest - past`
  - `percent = (latest - past) / past * 100`

## Frequency alignment and missing data behavior

- Alignment method: weekly 7-day as-of grid.
- For each anchor date and each series:
  - Use latest observation on/before anchor date.
  - Drop anchor date if any required series is older than 45 days.
- No silent coercion:
  - Non-numeric external values fail validation/parsing.
  - Missing windows return `null` changes.

## Regime classification (v1 heuristic)

Configurable thresholds are exposed in `DEFAULT_THRESHOLDS`.

Core rules:
- Liquidity supportive:
  - `netLiquidity 13w ROC > liquiditySupportiveRoc13w`
  - and `M2 13w ROC > m2SupportiveRoc13w`
- Inflation/tightening risk:
  - `WTI 4w ROC > oilInflationRiskRoc4w`
  - and `DXY 4w ROC > dxyInflationRiskRoc4w`
- Market outrunning liquidity:
  - `SPX 4w ROC > spxMomentumRoc4w`
  - and `liquidityVsSPX 4w ROC < liquidityVsSpxWeakeningRoc4w`
- RRP exhaustion tag:
  - `RRPONTSYD <= rrpNearZero`

## UI and extension points

- Reusable chart component:
  - `src/components/charts/TimeSeriesChart.tsx` (TradingView Lightweight Charts)
- KPI + regime components:
  - `src/components/dashboard/*`
- Add a new data vendor:
  1. Implement `MarketDataProvider`.
  2. Return `MarketSeriesMap`.
  3. Register in `src/lib/providers/market/index.ts`.

## Tests

- `src/lib/calculations/metrics.test.ts`
- `src/lib/regime/classifier.test.ts`

Run:
- `npm run test`

## Notes

- Secrets remain server-side in route handlers/providers.
- If your FRED key is ever exposed (screenshot/log/share), rotate it in your FRED account and update `.env.local`.
- Client receives transformed payload only.
- This app is analytical and does not place trades or produce execution signals.
- If a provider fails (for example missing `FRED_API_KEY`), the UI stays up in partial mode:
  - A warning banner explains what failed.
  - Any chart with available data still renders.
  - KPI/regime blocks are hidden when required core series are missing.
