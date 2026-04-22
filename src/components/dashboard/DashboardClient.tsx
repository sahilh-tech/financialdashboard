"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RegimePanel } from "@/components/dashboard/RegimePanel";
import { WarningBanner } from "@/components/dashboard/WarningBanner";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { formatNumber, formatPercent } from "@/lib/format";
import { dashboardResponseSchema, DashboardResponsePayload } from "@/lib/schemas/dashboard";

type PresetRange = "4W" | "13W" | "26W" | "1Y" | "2Y" | "ALL" | "CUSTOM";
type DateRange = { startDate: string; endDate: string };

function toDateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function subtractDays(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return toDateInputValue(date);
}

function buildPresetRange(preset: PresetRange): DateRange {
  if (preset === "4W") return { startDate: subtractDays(28), endDate: "" };
  if (preset === "13W") return { startDate: subtractDays(91), endDate: "" };
  if (preset === "26W") return { startDate: subtractDays(182), endDate: "" };
  if (preset === "1Y") return { startDate: subtractDays(365), endDate: "" };
  if (preset === "2Y") return { startDate: subtractDays(730), endDate: "" };
  if (preset === "ALL") return { startDate: "", endDate: "" };
  return { startDate: subtractDays(365), endDate: "" };
}

function buildDashboardUrl(range: DateRange): string {
  const params = new URLSearchParams();
  if (range.startDate) params.set("startDate", range.startDate);
  if (range.endDate) params.set("endDate", range.endDate);
  const query = params.toString();
  return query ? `/api/dashboard?${query}` : "/api/dashboard";
}

async function fetchDashboardData(range: DateRange): Promise<DashboardResponsePayload> {
  const response = await fetch(buildDashboardUrl(range), { method: "GET" });
  const raw = await response.json();
  if (!response.ok) {
    throw new Error(raw?.message ?? raw?.error ?? "Failed to fetch dashboard data.");
  }

  const parsed = dashboardResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid dashboard payload: ${parsed.error.message}`);
  }
  return parsed.data;
}

function toneFromPercent(value: number | null): "supportive" | "neutral" | "adverse" {
  if (value === null || Math.abs(value) < 0.5) return "neutral";
  return value > 0 ? "supportive" : "adverse";
}

function invertPercent(value: number | null): number | null {
  return value === null ? null : -value;
}

function formatTrillionsFromMillions(value: number): string {
  return `$${(value / 1_000_000).toFixed(2)}T`;
}

function formatBillionsFromMillions(value: number): string {
  return `$${Math.round(value / 1_000)}B`;
}

function formatChangeText(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const arrow = value >= 0 ? "▲" : "▼";
  return `${arrow} ${formatPercent(value)}`;
}

function rangeLabel(preset: PresetRange, range: DateRange): string {
  if (preset !== "CUSTOM") {
    if (preset === "ALL") return "All history";
    return `Last ${preset}`;
  }
  if (!range.startDate && !range.endDate) return "Custom";
  return `${range.startDate || "start"} → ${range.endDate || "latest"}`;
}

export function DashboardClient() {
  const [preset, setPreset] = useState<PresetRange>("1Y");
  const [customOpen, setCustomOpen] = useState(false);
  const [range, setRange] = useState<DateRange>(() => buildPresetRange("1Y"));

  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["macro-dashboard-data", range.startDate, range.endDate],
    queryFn: () => fetchDashboardData(range)
  });

  const selectedLabel = useMemo(() => rangeLabel(preset, range), [preset, range]);
  const latestDate = data?.metrics?.date ?? data?.series.netLiquidity.at(-1)?.date ?? "—";
  const observations = data?.series.netLiquidity.length ?? 0;

  if (isLoading) {
    return <div className="rounded-2xl border border-uiBorderMedium bg-uiSurfaceGlass p-6 text-uiTextSecondary">Loading dashboard data…</div>;
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-adverse/40 bg-uiSurfaceGlass p-6">
        <p className="text-sm font-semibold text-adverse">Data unavailable</p>
        <p className="mt-2 text-sm text-uiTextSecondary">
          {(error as Error | undefined)?.message ??
            "The dashboard could not be built. Check server logs and provider configuration."}
        </p>
      </div>
    );
  }

  const kpis = data.metrics
    ? [
        {
          label: "NET LIQUIDITY",
          value: formatTrillionsFromMillions(data.metrics.levels.netLiquidity),
          changeText: formatChangeText(data.metrics.changes13w.netLiquidity.percent),
          tone: toneFromPercent(data.metrics.changes13w.netLiquidity.percent),
          tooltip: "WALCL - WTREGEN - RRPONTSYD"
        },
        {
          label: "13W ΔNET LIQ",
          value: formatPercent(data.metrics.changes13w.netLiquidity.percent),
          changeText: formatChangeText(data.metrics.changes4w.netLiquidity.percent),
          tone: toneFromPercent(data.metrics.changes13w.netLiquidity.percent),
          tooltip: "13-week net liquidity change"
        },
        {
          label: "M2",
          value: `$${(data.metrics.levels.M2SL / 1_000).toFixed(2)}T`,
          changeText: formatChangeText(data.metrics.changes13w.M2SL.percent),
          tone: toneFromPercent(data.metrics.changes13w.M2SL.percent),
          tooltip: "M2SL money stock"
        },
        {
          label: "13W ΔM2",
          value: formatPercent(data.metrics.changes13w.M2SL.percent),
          changeText: formatChangeText(data.metrics.changes4w.M2SL.percent),
          tone: toneFromPercent(data.metrics.changes13w.M2SL.percent),
          tooltip: "13-week M2 change"
        },
        {
          label: "TGA",
          value: formatBillionsFromMillions(data.metrics.levels.WTREGEN),
          changeText: formatChangeText(data.metrics.changes4w.WTREGEN.percent),
          tone: toneFromPercent(invertPercent(data.metrics.changes4w.WTREGEN.percent)),
          tooltip: "Treasury General Account"
        },
        {
          label: "RRP",
          value: formatBillionsFromMillions(data.metrics.levels.RRPONTSYD),
          changeText: formatChangeText(data.metrics.changes4w.RRPONTSYD.percent),
          tone: toneFromPercent(invertPercent(data.metrics.changes4w.RRPONTSYD.percent)),
          tooltip: "Overnight reverse repo"
        },
        {
          label: "FED FUNDS",
          value: `${formatNumber(data.metrics.levels.FEDFUNDS, 2)}%`,
          changeText: formatChangeText(data.metrics.changes4w.FEDFUNDS.percent),
          tone: toneFromPercent(invertPercent(data.metrics.changes4w.FEDFUNDS.percent)),
          tooltip: "Effective fed funds"
        },
        {
          label: "2Y YIELD",
          value: `${formatNumber(data.metrics.levels.DGS2, 2)}%`,
          changeText: formatChangeText(data.metrics.changes4w.DGS2.percent),
          tone: toneFromPercent(invertPercent(data.metrics.changes4w.DGS2.percent)),
          tooltip: "US 2Y Treasury"
        },
        {
          label: "DXY",
          value: formatNumber(data.metrics.levels.DXY, 2),
          changeText: formatChangeText(data.metrics.changes4w.DXY.percent),
          tone: toneFromPercent(invertPercent(data.metrics.changes4w.DXY.percent)),
          tooltip: "US Dollar index"
        },
        {
          label: "WTI",
          value: `$${formatNumber(data.metrics.levels.WTI, 2)}`,
          changeText: formatChangeText(data.metrics.changes4w.WTI.percent),
          tone: toneFromPercent(invertPercent(data.metrics.changes4w.WTI.percent)),
          tooltip: "WTI crude oil"
        },
        {
          label: "SPX",
          value: formatNumber(data.metrics.levels.SPX, 0),
          changeText: formatChangeText(data.metrics.changes4w.SPX.percent),
          tone: toneFromPercent(data.metrics.changes4w.SPX.percent),
          tooltip: "S&P 500"
        }
      ]
    : [];

  const presetButtons: PresetRange[] = ["4W", "13W", "26W", "1Y", "2Y", "ALL"];

  return (
    <div className="min-h-screen bg-[linear-gradient(170deg,#0b0c10_0%,#0e1a24_30%,#091f2c_100%)] font-sans">
      <section className="sticky top-0 z-50 border-b border-primary/15 bg-[#0b0c10]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primaryDark font-sans text-base font-extrabold text-primaryText">
                S
              </div>
              <div>
                <h1 className="font-sans text-lg font-bold tracking-[0.03em] text-uiTextPrimary">SSH Tech</h1>
                <p className="text-[10px] uppercase tracking-[0.12em] text-uiTextDim">Macro Liquidity Dashboard</p>
              </div>
            </div>
          </div>

          <p className="font-mono text-xs text-uiTextDim">
            As of {latestDate} &nbsp;·&nbsp; Weekly &nbsp;·&nbsp; {observations} observations
          </p>
        </div>

        <div className="border-t border-uiBorderMedium bg-[#0e1a24]/50 px-8 py-3">
          <div className="flex flex-wrap items-center gap-4 xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex gap-1 rounded-lg bg-white/5 p-[3px]">
                {presetButtons.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setPreset(key);
                      setRange(buildPresetRange(key));
                      setCustomOpen(false);
                    }}
                    className={`rounded-md border-0 px-[14px] py-1.5 font-mono text-xs font-semibold tracking-[0.03em] transition ${
                      preset === key ? "bg-primary text-primaryText" : "text-uiTextDim hover:bg-white/5"
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>

              <div className="h-7 w-px bg-uiBorderMedium" />

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setPreset("CUSTOM");
                    setCustomOpen((open) => !open);
                  }}
                  className={`rounded-lg border border-uiBorderMedium px-3 py-1.5 text-xs font-medium transition ${
                    preset === "CUSTOM" ? "bg-primary/10 text-primary" : "bg-transparent text-uiTextDim hover:bg-white/5"
                  }`}
                >
                  Custom Range ▾
                </button>
                {customOpen ? (
                  <div className="absolute left-0 top-[calc(100%+8px)] z-10 flex min-w-[320px] flex-col gap-3 rounded-xl border border-uiBorderMedium bg-[#0b0c10] p-5 shadow-2xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-uiTextDim">Select Date Range</p>
                    <div className="flex gap-3">
                    <input
                      type="date"
                      value={range.startDate}
                      onChange={(event) => setRange((prev) => ({ ...prev, startDate: event.target.value }))}
                      className="w-full rounded-md border border-uiBorderMedium bg-[#0e1a24] px-2.5 py-2 font-mono text-[13px] text-uiTextPrimary outline-none ring-primary/40 focus:ring-2"
                    />
                    <input
                      type="date"
                      value={range.endDate}
                      onChange={(event) => setRange((prev) => ({ ...prev, endDate: event.target.value }))}
                      className="w-full rounded-md border border-uiBorderMedium bg-[#0e1a24] px-2.5 py-2 font-mono text-[13px] text-uiTextPrimary outline-none ring-primary/40 focus:ring-2"
                    />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <p className="text-xs text-uiTextDim">Showing: {selectedLabel}</p>
              <div className="h-7 w-px bg-uiBorderMedium" />
              <button
                type="button"
                onClick={() => refetch()}
                className="rounded-lg border border-uiBorderMedium bg-transparent px-3 py-1.5 text-xs font-semibold text-uiTextDim transition hover:bg-white/5 disabled:opacity-50"
                disabled={isFetching}
              >
                ⟳ {isFetching ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <main className="px-7 py-5">
        <WarningBanner warnings={data.warnings} />

        {kpis.length > 0 ? (
          <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </section>
        ) : (
          <section className="mt-4 rounded-2xl border border-uiBorderMedium bg-uiSurfaceGlass p-4 text-sm text-uiTextSecondary">
            KPI cards are hidden because one or more required core series is missing.
          </section>
        )}

        <section className="mt-5 grid gap-4 xl:grid-cols-2">
          <TimeSeriesChart
            title="Net Liquidity"
            subtitle={selectedLabel}
            series={[{ id: "net-liq", label: "Net Liquidity", data: data.series.netLiquidity, color: { line: "#07DFC1" }, type: "area" }]}
          />
          <TimeSeriesChart
            title="M2"
            subtitle={selectedLabel}
            series={[{ id: "m2", label: "M2", data: data.series.M2SL, color: { line: "#8BE9D8" } }]}
          />
          <TimeSeriesChart
            title="TGA and RRP"
            subtitle={selectedLabel}
            series={[
              { id: "tga", label: "TGA", data: data.series.WTREGEN, color: { line: "#EE6A7A" } },
              { id: "rrp", label: "RRP", data: data.series.RRPONTSYD, color: { line: "#F5BC7A" } }
            ]}
          />
          <TimeSeriesChart
            title="SPX and Liquidity vs SPX"
            subtitle={selectedLabel}
            series={[
              { id: "spx", label: "SPX", data: data.series.SPX, color: { line: "#86B7FE" } },
              { id: "liq-vs-spx", label: "Liquidity/SPX", data: data.series.liquidityVsSPX, color: { line: "#1FE2C4" } }
            ]}
          />
          <TimeSeriesChart
            title="Oil and DXY"
            subtitle={selectedLabel}
            series={[
              { id: "wti", label: "WTI", data: data.series.WTI, color: { line: "#F0A04B" } },
              { id: "dxy", label: "DXY", data: data.series.DXY, color: { line: "#9BAAF5" } }
            ]}
          />
          <TimeSeriesChart
            title="Fed Funds and 2Y Yield"
            subtitle={selectedLabel}
            series={[
              { id: "fedfunds", label: "Fed Funds", data: data.series.FEDFUNDS, color: { line: "#52F6D7" } },
              { id: "dgs2", label: "2Y", data: data.series.DGS2, color: { line: "#FF8A96" } }
            ]}
          />
        </section>

        {data.regime ? (
          <section className="mt-6">
            <RegimePanel regime={data.regime} whatChanged4w={data.whatChanged4w} />
          </section>
        ) : (
          <section className="mt-6 rounded-2xl border border-uiBorderMedium bg-uiSurfaceGlass p-4 text-sm text-uiTextSecondary">
            Regime classification is unavailable for this selection.
          </section>
        )}

        <footer className="mt-6 border-t border-uiBorderMedium py-8 text-center text-sm text-uiTextDim">
          SSH Tech · Macro Liquidity Dashboard · Data: FRED API + Market Feeds · Not financial advice
        </footer>
      </main>
    </div>
  );
}
