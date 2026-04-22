import { buildDashboardData } from "@/lib/dashboard/buildDashboardData";
import { logProviderError } from "@/lib/logging";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const thresholdQuerySchema = z.object({
  liquiditySupportiveRoc13w: z.coerce.number().optional(),
  liquidityContractingRoc13w: z.coerce.number().optional(),
  m2SupportiveRoc13w: z.coerce.number().optional(),
  oilInflationRiskRoc4w: z.coerce.number().optional(),
  dxyInflationRiskRoc4w: z.coerce.number().optional(),
  spxMomentumRoc4w: z.coerce.number().optional(),
  liquidityVsSpxWeakeningRoc4w: z.coerce.number().optional(),
  rrpNearZero: z.coerce.number().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = thresholdQuerySchema.safeParse(raw);

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Invalid threshold query parameters.", details: parsedQuery.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { startDate, endDate, ...thresholds } = parsedQuery.data;
    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json(
        { error: "Invalid date range. startDate must be <= endDate." },
        { status: 400 }
      );
    }

    const payload = await buildDashboardData(thresholds, { startDate, endDate });
    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=900"
      }
    });
  } catch (error) {
    logProviderError("dashboard-route", error);
    return NextResponse.json(
      {
        error: "Failed to build dashboard data.",
        message: error instanceof Error ? error.message : "Unknown server error."
      },
      { status: 502 }
    );
  }
}
