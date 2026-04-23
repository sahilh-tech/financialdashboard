import { buildLatestMetrics, buildWeeklyAlignedSeries, CoreWeeklySeries } from "@/lib/calculations/metrics";
import { fetchFredMacroSeries } from "@/lib/providers/fred";
import { fetchMarketSeries } from "@/lib/providers/market";
import { classifyRegime, DEFAULT_THRESHOLDS, RegimeThresholds } from "@/lib/regime/classifier";
import { TimeSeriesPoint } from "@/lib/types/timeSeries";
import { DashboardDataResponse } from "./types";

function describeChange(label: string, value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  const direction = value > 0 ? "rose" : value < 0 ? "fell" : "was flat";
  return `${label} ${direction} ${Math.abs(value).toFixed(2)}% over 4 weeks.`;
}

export async function buildDashboardData(
  thresholds: Partial<RegimeThresholds> = {},
  dateRange: { startDate?: string; endDate?: string } = {}
): Promise<DashboardDataResponse> {
  const mergedThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const warnings: string[] = [];
  let macroSeries: Awaited<ReturnType<typeof fetchFredMacroSeries>> | null = null;
  let market: Awaited<ReturnType<typeof fetchMarketSeries>> | null = null;

  try {
    macroSeries = await fetchFredMacroSeries();
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Macro provider failed.");
  }

  try {
    market = await fetchMarketSeries();
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Market provider failed.");
  }

  const coreSeries: CoreWeeklySeries = {
    WALCL: macroSeries?.WALCL.points ?? [],
    WTREGEN: macroSeries?.WTREGEN.points ?? [],
    RRPONTSYD: macroSeries?.RRPONTSYD.points ?? [],
    M2SL: macroSeries?.M2SL.points ?? [],
    FEDFUNDS: macroSeries?.FEDFUNDS.points ?? [],
    DGS2: macroSeries?.DGS2.points ?? [],
    DGS10: macroSeries?.DGS10.points ?? [],
    SPX: market?.data.SPX.points ?? [],
    DXY: market?.data.DXY.points ?? [],
    WTI: market?.data.WTI.points ?? [],
    BRENT: market?.data.BRENT.points ?? [],
    BTC: market?.data.BTC.points ?? []
  };

  const requiredSeriesKeys = ["WALCL", "WTREGEN", "RRPONTSYD", "M2SL", "FEDFUNDS", "DGS2", "SPX", "DXY", "WTI"] as const;
  const missingRequiredSeries = requiredSeriesKeys.filter((key) => coreSeries[key].length === 0);
  const canComputeRegime = missingRequiredSeries.length === 0;
  const hasAnyData = Object.values(coreSeries).some((seriesPoints) => seriesPoints.length > 0);

  if (missingRequiredSeries.length > 0) {
    warnings.push(`Missing required series: ${missingRequiredSeries.join(", ")}.`);
  }

  let series: DashboardDataResponse["series"] = {
    ...coreSeries,
    netLiquidity: [],
    liquidityVsSPX: []
  };
  let metrics: DashboardDataResponse["metrics"] = null;
  let regime: DashboardDataResponse["regime"] = null;
  let whatChanged4w: string[] = [];
  const { startDate, endDate } = dateRange;

  if (canComputeRegime) {
    const fullAligned = buildWeeklyAlignedSeries(coreSeries);
    const filterByDateRange = (points: TimeSeriesPoint[]): TimeSeriesPoint[] =>
      points.filter((point) => {
        if (startDate && point.date < startDate) {
          return false;
        }
        if (endDate && point.date > endDate) {
          return false;
        }
        return true;
      });

    series = {
      WALCL: filterByDateRange(fullAligned.WALCL),
      WTREGEN: filterByDateRange(fullAligned.WTREGEN),
      RRPONTSYD: filterByDateRange(fullAligned.RRPONTSYD),
      M2SL: filterByDateRange(fullAligned.M2SL),
      FEDFUNDS: filterByDateRange(fullAligned.FEDFUNDS),
      DGS2: filterByDateRange(fullAligned.DGS2),
      DGS10: filterByDateRange(fullAligned.DGS10),
      SPX: filterByDateRange(fullAligned.SPX),
      DXY: filterByDateRange(fullAligned.DXY),
      WTI: filterByDateRange(fullAligned.WTI),
      BRENT: filterByDateRange(fullAligned.BRENT),
      BTC: filterByDateRange(fullAligned.BTC),
      netLiquidity: filterByDateRange(fullAligned.netLiquidity),
      liquidityVsSPX: filterByDateRange(fullAligned.liquidityVsSPX)
    };

    if (series.netLiquidity.length === 0) {
      warnings.push("No points in selected date range. Expand the range to see charts and metrics.");
    } else {
      metrics = buildLatestMetrics(series);
      regime = classifyRegime(metrics, mergedThresholds);

      whatChanged4w = [
        describeChange("Net liquidity", metrics.changes4w.netLiquidity.percent),
        describeChange("M2", metrics.changes4w.M2SL.percent),
        describeChange("SPX", metrics.changes4w.SPX.percent),
        describeChange("WTI", metrics.changes4w.WTI.percent),
        describeChange("Brent", metrics.changes4w.BRENT.percent),
        describeChange("DXY", metrics.changes4w.DXY.percent)
      ].filter((line): line is string => line !== null);

      if (series.netLiquidity.length < 14) {
        warnings.push(
          "Selected date range has fewer than 14 weekly points. 13-week changes and regime classification may be limited."
        );
      }
    }
  } else {
    warnings.push(
      "Dashboard is in partial mode. At least one required series is missing, so derived metrics and regime tags are unavailable."
    );
  }

  const status: DashboardDataResponse["status"] = warnings.length === 0 ? "complete" : hasAnyData ? "partial" : "error";

  return {
    generatedAt: new Date().toISOString(),
    status,
    warnings,
    sourceInfo: {
      macroProvider: macroSeries ? "fred" : "unavailable",
      marketProvider: market?.provider ?? "unavailable",
      alignmentFrequency: "weekly_asof"
    },
    assumptions: [
      "All series are aligned to a 7-day as-of grid.",
      "An anchor date is dropped if any required series is older than 45 days.",
      "Window metrics use 4 and 13 weekly steps on aligned data."
    ],
    thresholds: mergedThresholds,
    series,
    metrics,
    regime,
    whatChanged4w
  };
}
