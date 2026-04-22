import { alignSeriesByAsOfWeeklyGrid } from "@/lib/calculations/alignment";
import { TimeSeriesPoint } from "@/lib/types/timeSeries";

export type CoreWeeklySeries = {
  WALCL: TimeSeriesPoint[];
  WTREGEN: TimeSeriesPoint[];
  RRPONTSYD: TimeSeriesPoint[];
  M2SL: TimeSeriesPoint[];
  FEDFUNDS: TimeSeriesPoint[];
  DGS2: TimeSeriesPoint[];
  DGS10: TimeSeriesPoint[];
  SPX: TimeSeriesPoint[];
  DXY: TimeSeriesPoint[];
  WTI: TimeSeriesPoint[];
  BTC: TimeSeriesPoint[];
};

export type DashboardWeeklySeries = CoreWeeklySeries & {
  netLiquidity: TimeSeriesPoint[];
  liquidityVsSPX: TimeSeriesPoint[];
};

export type WindowChange = {
  absolute: number | null;
  percent: number | null;
};

export type DashboardLatestMetrics = {
  date: string;
  levels: Record<string, number>;
  changes4w: Record<string, WindowChange>;
  changes13w: Record<string, WindowChange>;
  roc13w: Record<string, number | null>;
};

function computeWindowChange(series: TimeSeriesPoint[], periods: number): WindowChange {
  if (series.length <= periods) {
    return { absolute: null, percent: null };
  }

  const current = series[series.length - 1].value;
  const previous = series[series.length - 1 - periods].value;
  const absolute = current - previous;
  const percent = previous === 0 ? null : (absolute / previous) * 100;

  return { absolute, percent };
}

function divideSeries(numerator: TimeSeriesPoint[], denominator: TimeSeriesPoint[]): TimeSeriesPoint[] {
  return numerator
    .map((point, index) => {
      const denominatorPoint = denominator[index];
      if (!denominatorPoint || denominatorPoint.date !== point.date || denominatorPoint.value === 0) {
        return null;
      }

      return {
        date: point.date,
        value: point.value / denominatorPoint.value
      };
    })
    .filter((point): point is TimeSeriesPoint => point !== null);
}

export function buildWeeklyAlignedSeries(input: CoreWeeklySeries): DashboardWeeklySeries {
  const aligned = alignSeriesByAsOfWeeklyGrid(input, {
    stepDays: 7,
    maxStalenessDays: 45
  });

  const netLiquidity = aligned.WALCL.map((point, index) => ({
    date: point.date,
    value: point.value - aligned.WTREGEN[index].value - aligned.RRPONTSYD[index].value
  }));

  const liquidityVsSPX = divideSeries(netLiquidity, aligned.SPX);

  return {
    ...aligned,
    netLiquidity,
    liquidityVsSPX
  };
}

export function buildLatestMetrics(series: DashboardWeeklySeries): DashboardLatestMetrics {
  const latestPoint = series.netLiquidity.at(-1);
  if (!latestPoint) {
    throw new Error("No aligned points available to compute metrics.");
  }

  const metricKeys = [
    "WALCL",
    "WTREGEN",
    "RRPONTSYD",
    "M2SL",
    "FEDFUNDS",
    "DGS2",
    "DGS10",
    "SPX",
    "DXY",
    "WTI",
    "BTC",
    "netLiquidity",
    "liquidityVsSPX"
  ] as const;

  const levels: Record<string, number> = {};
  const changes4w: Record<string, WindowChange> = {};
  const changes13w: Record<string, WindowChange> = {};
  const roc13w: Record<string, number | null> = {};

  metricKeys.forEach((key) => {
    const selected = series[key];
    levels[key] = selected[selected.length - 1]?.value ?? Number.NaN;
    changes4w[key] = computeWindowChange(selected, 4);
    changes13w[key] = computeWindowChange(selected, 13);
    roc13w[key] = changes13w[key].percent;
  });

  return {
    date: latestPoint.date,
    levels,
    changes4w,
    changes13w,
    roc13w
  };
}
