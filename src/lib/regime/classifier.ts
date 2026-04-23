import { DashboardLatestMetrics } from "@/lib/calculations/metrics";

export type RegimeThresholds = {
  liquiditySupportiveRoc13w: number;
  liquidityContractingRoc13w: number;
  m2SupportiveRoc13w: number;
  oilInflationRiskRoc4w: number;
  dxyInflationRiskRoc4w: number;
  spxMomentumRoc4w: number;
  liquidityVsSpxWeakeningRoc4w: number;
  rrpNearZero: number;
};

export type RegimeClassification = {
  liquidityBackdrop: "expanding" | "flat" | "contracting";
  inflationPressure: "rising" | "neutral" | "easing";
  riskConditions: "supportive" | "mixed" | "stressed";
  tags: string[];
  riskNotes: string[];
};

export const DEFAULT_THRESHOLDS: RegimeThresholds = {
  liquiditySupportiveRoc13w: 2.5,
  liquidityContractingRoc13w: -2.5,
  m2SupportiveRoc13w: 1,
  oilInflationRiskRoc4w: 6,
  dxyInflationRiskRoc4w: 1.5,
  spxMomentumRoc4w: 2,
  liquidityVsSpxWeakeningRoc4w: -1.25,
  rrpNearZero: 100_000 // RRPONTSYD is normalized to millions USD before classification.
};

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function classifyRegime(
  metrics: DashboardLatestMetrics,
  thresholds: RegimeThresholds = DEFAULT_THRESHOLDS
): RegimeClassification {
  const netLiqRoc13 = metrics.roc13w.netLiquidity;
  const m2Roc13 = metrics.roc13w.M2SL;
  const wtiRoc4 = metrics.changes4w.WTI.percent;
  const brentRoc4 = metrics.changes4w.BRENT?.percent;
  const oilRoc4 =
    isNumber(wtiRoc4) && isNumber(brentRoc4)
      ? Math.max(wtiRoc4, brentRoc4)
      : isNumber(wtiRoc4)
        ? wtiRoc4
        : brentRoc4;
  const dxyRoc4 = metrics.changes4w.DXY.percent;
  const spxRoc4 = metrics.changes4w.SPX.percent;
  const liqVsSpxRoc4 = metrics.changes4w.liquidityVsSPX.percent;
  const rrpLevel = metrics.levels.RRPONTSYD;

  const tags: string[] = [];
  const riskNotes: string[] = [];

  let liquidityBackdrop: RegimeClassification["liquidityBackdrop"] = "flat";
  if (
    isNumber(netLiqRoc13) &&
    isNumber(m2Roc13) &&
    netLiqRoc13 > thresholds.liquiditySupportiveRoc13w &&
    m2Roc13 > thresholds.m2SupportiveRoc13w
  ) {
    liquidityBackdrop = "expanding";
    tags.push("Liquidity supportive");
  } else if (
    isNumber(netLiqRoc13) &&
    netLiqRoc13 < thresholds.liquidityContractingRoc13w
  ) {
    liquidityBackdrop = "contracting";
    tags.push("Liquidity contracting");
    riskNotes.push("Net liquidity trend is negative over 13 weeks.");
  }

  let inflationPressure: RegimeClassification["inflationPressure"] = "neutral";
  if (
    isNumber(oilRoc4) &&
    isNumber(dxyRoc4) &&
    oilRoc4 > thresholds.oilInflationRiskRoc4w &&
    dxyRoc4 > thresholds.dxyInflationRiskRoc4w
  ) {
    inflationPressure = "rising";
    tags.push("Inflation / tightening risk");
    riskNotes.push("Oil and DXY both rose over 4 weeks.");
  } else if (isNumber(oilRoc4) && oilRoc4 < -thresholds.oilInflationRiskRoc4w / 2) {
    inflationPressure = "easing";
  }

  let riskConditions: RegimeClassification["riskConditions"] = "mixed";
  if (
    isNumber(spxRoc4) &&
    isNumber(liqVsSpxRoc4) &&
    spxRoc4 > thresholds.spxMomentumRoc4w &&
    liqVsSpxRoc4 < thresholds.liquidityVsSpxWeakeningRoc4w
  ) {
    riskConditions = "stressed";
    tags.push("Market outrunning liquidity");
    riskNotes.push("SPX rose while liquidity-per-index support weakened.");
  } else if (liquidityBackdrop === "expanding" && inflationPressure !== "rising") {
    riskConditions = "supportive";
  }

  if (Number.isFinite(rrpLevel) && rrpLevel <= thresholds.rrpNearZero) {
    tags.push("RRP tailwind mostly exhausted");
    riskNotes.push("RRP balance is near configured floor.");
  }

  return {
    liquidityBackdrop,
    inflationPressure,
    riskConditions,
    tags,
    riskNotes
  };
}
