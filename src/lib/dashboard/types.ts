import { DashboardLatestMetrics, DashboardWeeklySeries } from "@/lib/calculations/metrics";
import { RegimeClassification, RegimeThresholds } from "@/lib/regime/classifier";

export type DashboardDataResponse = {
  generatedAt: string;
  status: "complete" | "partial" | "error";
  warnings: string[];
  sourceInfo: {
    macroProvider: "fred" | "unavailable";
    marketProvider: string | "unavailable";
    alignmentFrequency: "weekly_asof";
  };
  assumptions: string[];
  thresholds: RegimeThresholds;
  series: DashboardWeeklySeries;
  metrics: DashboardLatestMetrics | null;
  regime: RegimeClassification | null;
  whatChanged4w: string[];
};
