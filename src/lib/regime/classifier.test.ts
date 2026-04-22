import { describe, expect, it } from "vitest";
import { DashboardLatestMetrics } from "@/lib/calculations/metrics";
import { classifyRegime } from "@/lib/regime/classifier";

function baseMetrics(): DashboardLatestMetrics {
  return {
    date: "2026-04-17",
    levels: {
      RRPONTSYD: 80_000
    },
    changes4w: {
      WTI: { absolute: 5, percent: 8 },
      DXY: { absolute: 2, percent: 2 },
      SPX: { absolute: 100, percent: 3 },
      liquidityVsSPX: { absolute: -0.01, percent: -2 }
    },
    changes13w: {
      netLiquidity: { absolute: 100_000, percent: 4 },
      M2SL: { absolute: 300, percent: 2 }
    },
    roc13w: {
      netLiquidity: 4,
      M2SL: 2
    }
  } as DashboardLatestMetrics;
}

describe("classifyRegime", () => {
  it("flags stressed when SPX outruns liquidity", () => {
    const regime = classifyRegime(baseMetrics());
    expect(regime.riskConditions).toBe("stressed");
    expect(regime.tags).toContain("Market outrunning liquidity");
  });

  it("returns supportive when liquidity expands and inflation is not rising", () => {
    const metrics = baseMetrics();
    metrics.changes4w.WTI.percent = 1;
    metrics.changes4w.DXY.percent = 0.4;
    metrics.changes4w.liquidityVsSPX.percent = 0.5;
    const regime = classifyRegime(metrics);
    expect(regime.liquidityBackdrop).toBe("expanding");
    expect(regime.riskConditions).toBe("supportive");
  });
});
