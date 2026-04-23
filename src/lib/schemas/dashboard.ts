import { z } from "zod";

const pointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number()
});

const namedPointSeriesSchema = z.array(pointSchema);

const windowChangeSchema = z.object({
  absolute: z.number().nullable(),
  percent: z.number().nullable()
});

const regimeSchema = z.object({
  liquidityBackdrop: z.enum(["expanding", "flat", "contracting"]),
  inflationPressure: z.enum(["rising", "neutral", "easing"]),
  riskConditions: z.enum(["supportive", "mixed", "stressed"]),
  tags: z.array(z.string()),
  riskNotes: z.array(z.string())
});

export const dashboardResponseSchema = z.object({
  generatedAt: z.string(),
  status: z.enum(["complete", "partial", "error"]),
  warnings: z.array(z.string()),
  sourceInfo: z.object({
    macroProvider: z.enum(["fred", "unavailable"]),
    marketProvider: z.union([z.string(), z.literal("unavailable")]),
    alignmentFrequency: z.literal("weekly_asof")
  }),
  assumptions: z.array(z.string()),
  thresholds: z.record(z.string(), z.number()),
  series: z.object({
    WALCL: namedPointSeriesSchema,
    WTREGEN: namedPointSeriesSchema,
    RRPONTSYD: namedPointSeriesSchema,
    M2SL: namedPointSeriesSchema,
    FEDFUNDS: namedPointSeriesSchema,
    DGS2: namedPointSeriesSchema,
    DGS10: namedPointSeriesSchema,
    SPX: namedPointSeriesSchema,
    DXY: namedPointSeriesSchema,
    WTI: namedPointSeriesSchema,
    BRENT: namedPointSeriesSchema,
    BTC: namedPointSeriesSchema,
    netLiquidity: namedPointSeriesSchema,
    liquidityVsSPX: namedPointSeriesSchema
  }),
  metrics: z
    .object({
      date: z.string(),
      levels: z.record(z.string(), z.number()),
      changes4w: z.record(z.string(), windowChangeSchema),
      changes13w: z.record(z.string(), windowChangeSchema),
      roc13w: z.record(z.string(), z.number().nullable())
    })
    .nullable(),
  regime: regimeSchema.nullable(),
  whatChanged4w: z.array(z.string())
});

export type DashboardResponsePayload = z.infer<typeof dashboardResponseSchema>;
