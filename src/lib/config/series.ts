import { SeriesKey } from "@/lib/types/timeSeries";

type FredSeriesConfig = {
  key: Extract<
    SeriesKey,
    "WALCL" | "WTREGEN" | "RRPONTSYD" | "M2SL" | "FEDFUNDS" | "DGS2" | "DGS10"
  >;
  fredId: string;
  label: string;
  unit: string;
  frequency: "daily" | "weekly" | "monthly";
  valueMultiplier?: number;
};

export const FRED_SERIES: readonly FredSeriesConfig[] = [
  {
    key: "WALCL",
    fredId: "WALCL",
    label: "Fed Balance Sheet (WALCL)",
    unit: "Millions of USD",
    frequency: "weekly"
  },
  {
    key: "WTREGEN",
    fredId: "WTREGEN",
    label: "Treasury General Account (WTREGEN)",
    unit: "Millions of USD",
    frequency: "weekly"
  },
  {
    key: "RRPONTSYD",
    fredId: "RRPONTSYD",
    label: "Overnight Reverse Repo (RRPONTSYD)",
    // FRED publishes RRPONTSYD in billions. Normalize to millions so it is comparable with WALCL and WTREGEN.
    unit: "Millions of USD",
    frequency: "daily",
    valueMultiplier: 1_000
  },
  {
    key: "M2SL",
    fredId: "M2SL",
    label: "M2 Money Stock (M2SL)",
    unit: "Billions of USD",
    frequency: "monthly"
  },
  {
    key: "FEDFUNDS",
    fredId: "FEDFUNDS",
    label: "Effective Fed Funds (FEDFUNDS)",
    unit: "Percent",
    frequency: "monthly"
  },
  {
    key: "DGS2",
    fredId: "DGS2",
    label: "2Y Treasury Yield (DGS2)",
    unit: "Percent",
    frequency: "daily"
  },
  {
    key: "DGS10",
    fredId: "DGS10",
    label: "10Y Treasury Yield (DGS10)",
    unit: "Percent",
    frequency: "daily"
  }
] as const;

type MarketSeriesConfig = {
  key: Extract<SeriesKey, "SPX" | "DXY" | "WTI" | "BRENT" | "BTC">;
  symbol: string;
  label: string;
  unit: string;
};

export const MARKET_SERIES: readonly MarketSeriesConfig[] = [
  { key: "SPX", symbol: "^SPX", label: "S&P 500", unit: "Index points" },
  { key: "DXY", symbol: "DXY", label: "US Dollar Index", unit: "Index points" },
  { key: "WTI", symbol: "CL=F", label: "WTI Crude Oil", unit: "USD per barrel" },
  { key: "BRENT", symbol: "BZ=F", label: "Brent Crude Oil", unit: "USD per barrel" },
  { key: "BTC", symbol: "BTC-USD", label: "Bitcoin", unit: "USD" }
] as const;
