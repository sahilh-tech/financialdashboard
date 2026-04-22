import { describe, expect, it } from "vitest";
import { buildLatestMetrics, buildWeeklyAlignedSeries, CoreWeeklySeries } from "@/lib/calculations/metrics";
import { TimeSeriesPoint } from "@/lib/types/timeSeries";

function makeSeries(start: number, step: number, points = 30): TimeSeriesPoint[] {
  return Array.from({ length: points }, (_, index) => ({
    date: new Date(Date.UTC(2024, 0, 5 + index * 7)).toISOString().slice(0, 10) as TimeSeriesPoint["date"],
    value: start + index * step
  }));
}

function makeInput(): CoreWeeklySeries {
  return {
    WALCL: makeSeries(8_500_000, 4_000),
    WTREGEN: makeSeries(650_000, -500),
    RRPONTSYD: makeSeries(300_000, -4_000),
    M2SL: makeSeries(20_000, 30),
    FEDFUNDS: makeSeries(5.5, -0.01),
    DGS2: makeSeries(4.8, -0.02),
    DGS10: makeSeries(4.2, -0.01),
    SPX: makeSeries(4600, 10),
    DXY: makeSeries(103, -0.1),
    WTI: makeSeries(74, 0.2),
    BTC: makeSeries(35000, 300)
  };
}

describe("metrics", () => {
  it("builds aligned series and net liquidity", () => {
    const aligned = buildWeeklyAlignedSeries(makeInput());
    expect(aligned.netLiquidity.length).toBeGreaterThan(20);
    const first = aligned.netLiquidity[0];
    expect(first.value).toBeCloseTo(
      aligned.WALCL[0].value - aligned.WTREGEN[0].value - aligned.RRPONTSYD[0].value,
      6
    );
  });

  it("computes 4w and 13w changes", () => {
    const aligned = buildWeeklyAlignedSeries(makeInput());
    const metrics = buildLatestMetrics(aligned);
    expect(metrics.changes4w.netLiquidity.absolute).not.toBeNull();
    expect(metrics.changes13w.M2SL.percent).not.toBeNull();
    expect(metrics.levels.SPX).toBeGreaterThan(0);
  });
});
