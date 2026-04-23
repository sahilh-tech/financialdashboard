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
  BRENT: TimeSeriesPoint[];
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

function alignOptionalSeriesToAnchors(points: TimeSeriesPoint[], anchors: TimeSeriesPoint[], maxStalenessDays = 45): TimeSeriesPoint[] {
  if (points.length === 0 || anchors.length === 0) {
    return [];
  }

  let cursor = 0;
  return anchors
    .map((anchor) => {
      while (cursor + 1 < points.length && points[cursor + 1].date <= anchor.date) {
        cursor += 1;
      }

      const point = points[cursor];
      if (!point || point.date > anchor.date) {
        return null;
      }

      const anchorTime = new Date(`${anchor.date}T00:00:00.000Z`).getTime();
      const pointTime = new Date(`${point.date}T00:00:00.000Z`).getTime();
      const ageDays = (anchorTime - pointTime) / (24 * 60 * 60 * 1000);
      if (ageDays > maxStalenessDays) {
        return null;
      }

      return {
        date: anchor.date,
        value: point.value
      };
    })
    .filter((point): point is TimeSeriesPoint => point !== null);
}

export function buildWeeklyAlignedSeries(input: CoreWeeklySeries): DashboardWeeklySeries {
  const aligned = alignSeriesByAsOfWeeklyGrid(
    {
      WALCL: input.WALCL,
      WTREGEN: input.WTREGEN,
      RRPONTSYD: input.RRPONTSYD,
      M2SL: input.M2SL,
      FEDFUNDS: input.FEDFUNDS,
      DGS2: input.DGS2,
      SPX: input.SPX,
      DXY: input.DXY,
      WTI: input.WTI
    },
    {
      stepDays: 7,
      maxStalenessDays: 45
    }
  );

  const netLiquidity = aligned.WALCL.map((point, index) => ({
    date: point.date,
    value: point.value - aligned.WTREGEN[index].value - aligned.RRPONTSYD[index].value
  }));

  const liquidityVsSPX = divideSeries(netLiquidity, aligned.SPX);

  return {
    ...aligned,
    BRENT: alignOptionalSeriesToAnchors(input.BRENT, aligned.WTI),
    DGS10: input.DGS10,
    BTC: input.BTC,
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
    "BRENT",
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
