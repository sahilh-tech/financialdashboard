"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { LineStyle, Range, Time } from "lightweight-charts";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RegimePanel } from "@/components/dashboard/RegimePanel";
import { WarningBanner } from "@/components/dashboard/WarningBanner";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { formatNumber, formatPercent } from "@/lib/format";
import { dashboardResponseSchema, DashboardResponsePayload } from "@/lib/schemas/dashboard";

type PresetRange = "4W" | "13W" | "26W" | "1Y" | "2Y" | "5Y" | "10Y" | "ALL" | "CUSTOM";
type DateRange = { startDate: string; endDate: string };
type ChartPoint = { date: string; value: number };

function toDateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function subtractDays(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return toDateInputValue(date);
}

function subtractDaysFromAnchor(anchorDate: string | undefined, days: number): string {
  if (!anchorDate || anchorDate === "—") {
    return subtractDays(days);
  }
  const date = new Date(`${anchorDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return toDateInputValue(date);
}

function buildPresetRange(preset: PresetRange, anchorDate?: string): DateRange {
  if (preset === "4W") return { startDate: subtractDaysFromAnchor(anchorDate, 28), endDate: anchorDate ?? "" };
  if (preset === "13W") return { startDate: subtractDaysFromAnchor(anchorDate, 91), endDate: anchorDate ?? "" };
  if (preset === "26W") return { startDate: subtractDaysFromAnchor(anchorDate, 182), endDate: anchorDate ?? "" };
  if (preset === "1Y") return { startDate: subtractDaysFromAnchor(anchorDate, 365), endDate: anchorDate ?? "" };
  if (preset === "2Y") return { startDate: subtractDaysFromAnchor(anchorDate, 730), endDate: anchorDate ?? "" };
  if (preset === "5Y") return { startDate: subtractDaysFromAnchor(anchorDate, 365 * 5), endDate: anchorDate ?? "" };
  if (preset === "10Y") return { startDate: subtractDaysFromAnchor(anchorDate, 365 * 10), endDate: anchorDate ?? "" };
  if (preset === "ALL") return { startDate: "", endDate: "" };
  return { startDate: subtractDaysFromAnchor(anchorDate, 365), endDate: anchorDate ?? "" };
}

async function fetchDashboardData(): Promise<DashboardResponsePayload> {
  const response = await fetch("/api/dashboard", { method: "GET" });
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
  if (!Number.isFinite(value)) return "—";
  const billions = value / 1_000;
  const absBillions = Math.abs(billions);
  if (absBillions >= 1_000) return `$${(billions / 1_000).toFixed(2)}T`;
  if (absBillions >= 100) return `$${Math.round(billions)}B`;
  if (absBillions >= 10) return `$${billions.toFixed(1)}B`;
  if (absBillions >= 1) return `$${billions.toFixed(2)}B`;
  return `$${Math.round(value)}M`;
}

function formatChangeText(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const arrow = value >= 0 ? "▲" : "▼";
  return `${arrow} ${formatPercent(value)}`;
}

function formatPointChangeText(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const arrow = value >= 0 ? "▲" : "▼";
  const sign = value >= 0 ? "+" : "";
  return `${arrow} ${sign}${value.toFixed(2)}pp`;
}

function scalePoints(points: ChartPoint[] | undefined, divisor: number): ChartPoint[] {
  return (points ?? []).map((point) => ({
    date: point.date,
    value: point.value / divisor
  }));
}

function formatChartValue(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function formatBillionsAxis(valueInBillions: number): string {
  const abs = Math.abs(valueInBillions);
  if (!Number.isFinite(valueInBillions)) return "—";
  if (abs >= 1_000) return `$${(valueInBillions / 1_000).toFixed(1)}T`;
  if (abs >= 100) return `$${valueInBillions.toFixed(0)}B`;
  if (abs >= 1) return `$${valueInBillions.toFixed(2)}B`;
  return `$${(valueInBillions * 1_000).toFixed(0)}M`;
}

function formatTrillionsAxis(valueInTrillions: number): string {
  if (!Number.isFinite(valueInTrillions)) return "—";
  return `$${valueInTrillions.toFixed(2)}T`;
}

function formatRatioAxis(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

function formatPercentAxis(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}%`;
}

function formatIndexAxis(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(1);
}

function rangeLabel(preset: PresetRange, range: DateRange): string {
  if (preset !== "CUSTOM") {
    if (preset === "ALL") return "All history";
    return `Last ${preset}`;
  }
  if (!range.startDate && !range.endDate) return "Custom";
  return `${range.startDate || "start"} → ${range.endDate || "latest"}`;
}

function toVisibleRange(range: DateRange): Range<Time> | null {
  if (!range.startDate && !range.endDate) {
    return null;
  }
  return {
    from: range.startDate || range.endDate,
    to: range.endDate || range.startDate
  };
}

function LinkIcon(): JSX.Element {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4.93" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 19.07" />
    </svg>
  );
}

function UnlinkIcon(): JSX.Element {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="m18.84 12.25 1.06-1.06a5 5 0 0 0-7.07-7.07l-1.06 1.06" />
      <path d="m5.16 11.75-1.06 1.06a5 5 0 0 0 7.07 7.07l1.06-1.06" />
      <path d="m8 2 1.5 4" />
      <path d="m14.5 18 1.5 4" />
      <path d="M2 8h4" />
      <path d="M18 16h4" />
    </svg>
  );
}

function RefreshIcon({ spinning = false }: { spinning?: boolean }): JSX.Element {
  return (
    <svg aria-hidden="true" className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 12a9 9 0 0 1-15.2 6.5" />
      <path d="M3 12A9 9 0 0 1 18.2 5.5" />
      <path d="M18 2v4h4" />
      <path d="M6 22v-4H2" />
    </svg>
  );
}

type DateField = "startDate" | "endDate";

function parseDateInput(value: string): Date {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function MiniCalendar({
  value,
  onSelect
}: {
  value: string;
  onSelect: (value: string) => void;
}): JSX.Element {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const selected = parseDateInput(value);
    return new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1));
  });

  useEffect(() => {
    const selected = parseDateInput(value);
    setVisibleMonth(new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1)));
  }, [value]);

  const selectedDate = value;
  const month = visibleMonth.getUTCMonth();
  const year = visibleMonth.getUTCFullYear();
  const firstDay = visibleMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const previousMonthDays = new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth(), 0)).getUTCDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - firstDay + 1;
    const date = new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth(), dayNumber));
    const inCurrentMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
    const label = inCurrentMonth ? dayNumber : dayNumber < 1 ? previousMonthDays + dayNumber : dayNumber - daysInMonth;
    return {
      dateValue: toDateInputValue(date),
      label,
      inCurrentMonth
    };
  });

  function shiftMonth(months: number): void {
    setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + months, 1)));
  }

  function setMonth(nextMonth: number): void {
    setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), nextMonth, 1)));
  }

  function selectToday(): void {
    const today = toDateInputValue(new Date());
    onSelect(today);
    const parsed = parseDateInput(today);
    setVisibleMonth(new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1)));
  }

  return (
    <div className="rounded-xl border border-uiBorderMedium bg-uiSurfaceGlassDeep p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => shiftMonth(-1)} className="rounded-md border border-uiBorderMedium px-2 py-1 text-uiTextDim transition hover:border-primary/30 hover:text-primary">
          ←
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <select
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
            className="min-w-0 flex-1 rounded-md border border-uiBorderMedium bg-[#0e1a24] px-2 py-1.5 text-xs font-semibold text-uiTextPrimary outline-none transition hover:border-primary/30 focus:border-primary/50"
            title="Jump to month"
          >
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index} value={index}>
                {new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, index, 1)))}
              </option>
            ))}
          </select>
          <span className="w-14 text-center font-mono text-xs font-semibold text-uiTextPrimary">{year}</span>
        </div>
        <button type="button" onClick={() => shiftMonth(1)} className="rounded-md border border-uiBorderMedium px-2 py-1 text-uiTextDim transition hover:border-primary/30 hover:text-primary">
          →
        </button>
      </div>
      <div className="mb-4 flex justify-between gap-2">
        <button type="button" onClick={() => shiftMonth(-12)} className="rounded-md border border-uiBorderMedium px-2 py-1 text-[11px] font-semibold text-uiTextDim transition hover:border-primary/30 hover:text-primary">
          −1Y
        </button>
        <button type="button" onClick={() => shiftMonth(-3)} className="rounded-md border border-uiBorderMedium px-2 py-1 text-[11px] font-semibold text-uiTextDim transition hover:border-primary/30 hover:text-primary">
          −3M
        </button>
        <button type="button" onClick={() => shiftMonth(3)} className="rounded-md border border-uiBorderMedium px-2 py-1 text-[11px] font-semibold text-uiTextDim transition hover:border-primary/30 hover:text-primary">
          +3M
        </button>
        <button type="button" onClick={() => shiftMonth(12)} className="rounded-md border border-uiBorderMedium px-2 py-1 text-[11px] font-semibold text-uiTextDim transition hover:border-primary/30 hover:text-primary">
          +1Y
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span key={`${day}-${index}`} className="py-1 text-[11px] font-semibold text-uiTextDim">
            {day}
          </span>
        ))}
        {cells.map((cell) => (
          <button
            key={cell.dateValue}
            type="button"
            onClick={() => onSelect(cell.dateValue)}
            className={`rounded-md py-1.5 text-sm font-semibold transition ${
              selectedDate === cell.dateValue
                ? "bg-primary text-primaryText"
                : cell.inCurrentMonth
                  ? "text-uiTextPrimary hover:bg-primary/10 hover:text-primary"
                  : "text-uiTextDim/45 hover:bg-white/5"
            }`}
          >
            {cell.label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-between">
        <button type="button" onClick={() => onSelect("")} className="text-xs font-semibold text-uiTextDim transition hover:text-primary">
          Clear
        </button>
        <button type="button" onClick={selectToday} className="text-xs font-semibold text-primary transition hover:text-uiTextSecondary">
          Today
        </button>
      </div>
    </div>
  );
}

export function DashboardClient() {
  const [preset, setPreset] = useState<PresetRange>("1Y");
  const [customOpen, setCustomOpen] = useState(false);
  const [range, setRange] = useState<DateRange>(() => buildPresetRange("1Y"));
  const [draftRange, setDraftRange] = useState<DateRange>(() => buildPresetRange("1Y"));
  const [activeDateField, setActiveDateField] = useState<DateField>("startDate");
  const [syncCharts, setSyncCharts] = useState(false);
  const [syncedRange, setSyncedRange] = useState<Range<Time> | null>(null);

  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["macro-dashboard-data"],
    queryFn: fetchDashboardData,
    placeholderData: keepPreviousData
  });

  const latestDataDate = data?.metrics?.date ?? data?.series.netLiquidity.at(-1)?.date;
  const selectedLabel = useMemo(() => rangeLabel(preset, range), [preset, range]);
  const latestDate = latestDataDate ?? "—";
  const observations = data?.series.netLiquidity.length ?? 0;
  const showSkeleton = isLoading || isFetching;
  const selectedVisibleRange = syncCharts && syncedRange ? syncedRange : toVisibleRange(range);
  const handleSyncedRangeChange = useCallback((nextRange: Range<Time> | null) => {
    setSyncedRange((previousRange) => {
      if (previousRange?.from === nextRange?.from && previousRange?.to === nextRange?.to) {
        return previousRange;
      }
      return nextRange;
    });
  }, []);

  useEffect(() => {
    if (!latestDataDate || preset === "CUSTOM") {
      return;
    }

    const nextRange = buildPresetRange(preset, latestDataDate);
    if (nextRange.startDate !== range.startDate || nextRange.endDate !== range.endDate) {
      setRange(nextRange);
      setDraftRange(nextRange);
    }
  }, [latestDataDate, preset, range.startDate, range.endDate]);

  if (error && !data) {
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

  const kpis = data?.metrics
    ? [
        {
          label: "NET LIQUIDITY",
          value: formatTrillionsFromMillions(data.metrics.levels.netLiquidity),
          changeText: formatChangeText(data.metrics.changes13w.netLiquidity.percent),
          tone: toneFromPercent(data.metrics.changes13w.netLiquidity.percent),
          tooltip: "Fed balance sheet minus TGA and RRP.",
          valueTooltip: "FRED: WALCL - WTREGEN - RRPONTSYD.",
          changeTooltip: "13-week percent change."
        },
        {
          label: "13W ΔNET LIQ",
          value: formatPercent(data.metrics.changes13w.netLiquidity.percent),
          changeText: formatChangeText(data.metrics.changes4w.netLiquidity.percent),
          tone: toneFromPercent(data.metrics.changes13w.netLiquidity.percent),
          tooltip: "13-week change in net liquidity.",
          valueTooltip: "Percent change over 13 weekly points.",
          changeTooltip: "4-week percent change."
        },
        {
          label: "M2",
          value: `$${(data.metrics.levels.M2SL / 1_000).toFixed(2)}T`,
          changeText: formatChangeText(data.metrics.changes13w.M2SL.percent),
          tone: toneFromPercent(data.metrics.changes13w.M2SL.percent),
          tooltip: "Broad money supply from FRED.",
          valueTooltip: "FRED M2SL, monthly, shown in $T.",
          changeTooltip: "13-week percent change."
        },
        {
          label: "13W ΔM2",
          value: formatPercent(data.metrics.changes13w.M2SL.percent),
          changeText: formatChangeText(data.metrics.changes4w.M2SL.percent),
          tone: toneFromPercent(data.metrics.changes13w.M2SL.percent),
          tooltip: "13-week change in M2 money supply.",
          valueTooltip: "Percent change over 13 weekly points.",
          changeTooltip: "4-week percent change."
        },
        {
          label: "TGA",
          value: formatBillionsFromMillions(data.metrics.levels.WTREGEN),
          changeText: formatChangeText(data.metrics.changes4w.WTREGEN.percent),
          tone: toneFromPercent(invertPercent(data.metrics.changes4w.WTREGEN.percent)),
          tooltip: "Treasury cash at the Fed.",
          valueTooltip: "FRED WTREGEN, shown in $B.",
          changeTooltip: "4-week change. Higher TGA drains liquidity."
        },
        {
          label: "RRP",
          value: formatBillionsFromMillions(data.metrics.levels.RRPONTSYD),
          changeText: formatChangeText(data.metrics.changes4w.RRPONTSYD.percent),
          tone: toneFromPercent(invertPercent(data.metrics.changes4w.RRPONTSYD.percent)),
          tooltip: "Overnight reverse repo usage.",
          valueTooltip: "FRED RRPONTSYD, normalized and shown in $B.",
          changeTooltip: "4-week change. Falling RRP can support liquidity."
        },
        {
          label: "FED FUNDS",
          value: `${formatNumber(data.metrics.levels.FEDFUNDS, 2)}%`,
          changeText: formatPointChangeText(data.metrics.changes4w.FEDFUNDS.absolute),
          tone: toneFromPercent(invertPercent(data.metrics.changes4w.FEDFUNDS.absolute)),
          tooltip: "Policy-rate anchor from FRED.",
          valueTooltip: "FRED FEDFUNDS, shown as percent.",
          changeTooltip: "4-week percentage-point change. Rising rates tighten conditions."
        },
        {
          label: "2Y YIELD",
          value: `${formatNumber(data.metrics.levels.DGS2, 2)}%`,
          changeText: formatPointChangeText(data.metrics.changes4w.DGS2.absolute),
          tone: toneFromPercent(invertPercent(data.metrics.changes4w.DGS2.absolute)),
          tooltip: "Near-term Treasury yield.",
          valueTooltip: "FRED DGS2, shown as percent.",
          changeTooltip: "4-week percentage-point change. Rising 2Y yield is tightening."
        },
        {
          label: "DXY",
          value: formatNumber(data.metrics.levels.DXY, 2),
          changeText: formatChangeText(data.metrics.changes4w.DXY.percent),
          tone: toneFromPercent(invertPercent(data.metrics.changes4w.DXY.percent)),
          tooltip: "US Dollar Index.",
          valueTooltip: "Configured market provider DXY series.",
          changeTooltip: "4-week change. Rising DXY tightens conditions."
        },
        {
          label: "WTI",
          value: `$${formatNumber(data.metrics.levels.WTI, 2)}`,
          changeText: formatChangeText(data.metrics.changes4w.WTI.percent),
          tone: toneFromPercent(invertPercent(data.metrics.changes4w.WTI.percent)),
          tooltip: "US oil benchmark.",
          valueTooltip: "FRED DCOILWTICO, USD per barrel.",
          changeTooltip: "4-week change. Rising oil adds inflation risk."
        },
        {
          label: "BRENT",
          value: `$${formatNumber(data.metrics.levels.BRENT, 2)}`,
          changeText: formatChangeText(data.metrics.changes4w.BRENT.percent),
          tone: toneFromPercent(invertPercent(data.metrics.changes4w.BRENT.percent)),
          tooltip: "Global oil benchmark.",
          valueTooltip: "FRED DCOILBRENTEU, USD per barrel.",
          changeTooltip: "4-week change. Rising Brent adds inflation risk."
        },
        {
          label: "SPX",
          value: formatNumber(data.metrics.levels.SPX, 0),
          changeText: formatChangeText(data.metrics.changes4w.SPX.percent),
          tone: toneFromPercent(data.metrics.changes4w.SPX.percent),
          tooltip: "Risk-asset proxy.",
          valueTooltip: "FRED SP500 index level.",
          changeTooltip: "4-week change. Rising SPX is risk-supportive."
        }
      ]
    : [
        { label: "NET LIQUIDITY", value: "", tooltip: "WALCL - WTREGEN - RRPONTSYD", tone: "neutral" as const },
        { label: "13W ΔNET LIQ", value: "", tooltip: "13-week net liquidity change", tone: "neutral" as const },
        { label: "M2", value: "", tooltip: "M2SL money stock", tone: "neutral" as const },
        { label: "13W ΔM2", value: "", tooltip: "13-week M2 change", tone: "neutral" as const },
        { label: "TGA", value: "", tooltip: "Treasury General Account", tone: "neutral" as const },
        { label: "RRP", value: "", tooltip: "Overnight reverse repo", tone: "neutral" as const },
        { label: "FED FUNDS", value: "", tooltip: "Effective fed funds", tone: "neutral" as const },
        { label: "2Y YIELD", value: "", tooltip: "US 2Y Treasury", tone: "neutral" as const },
        { label: "DXY", value: "", tooltip: "US Dollar index", tone: "neutral" as const },
        { label: "WTI", value: "", tooltip: "West Texas Intermediate crude oil", tone: "neutral" as const },
        { label: "BRENT", value: "", tooltip: "Brent crude oil benchmark", tone: "neutral" as const },
        { label: "SPX", value: "", tooltip: "S&P 500", tone: "neutral" as const }
      ];

  const presetButtons: PresetRange[] = ["4W", "13W", "26W", "1Y", "2Y", "5Y", "10Y", "ALL"];

  return (
    <div className="min-h-screen bg-[linear-gradient(170deg,#0b0c10_0%,#0e1a24_30%,#091f2c_100%)] font-sans">
      <section className="sticky top-0 z-50 border-b border-primary/15 bg-[#0b0c10]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between px-8 py-4">
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

        <div className="border-t border-uiBorderMedium bg-[#0e1a24]/50">
          <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-4 px-8 py-3 xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex gap-1 rounded-lg bg-white/5 p-[3px]">
                {presetButtons.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setPreset(key);
                      const nextRange = buildPresetRange(key, latestDataDate);
                      setRange(nextRange);
                      setDraftRange(nextRange);
                      setSyncedRange(null);
                      setCustomOpen(false);
                    }}
                    className={`rounded-md border-0 px-[14px] py-1.5 font-mono text-xs font-semibold tracking-[0.03em] transition ${
                      preset === key ? "bg-primary text-primaryText" : "text-uiTextDim hover:bg-white/5 hover:text-[#dde3e9]"
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
                    setDraftRange(range);
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
                      {(["startDate", "endDate"] as const).map((field) => (
                        <button
                          key={field}
                          type="button"
                          onClick={() => setActiveDateField(field)}
                          className={`w-full rounded-lg border px-3 py-2 text-left font-mono text-[13px] transition ${
                            activeDateField === field
                              ? "border-primary/50 bg-primary/10 text-primary"
                              : "border-uiBorderMedium bg-[#0e1a24] text-uiTextPrimary hover:border-primary/25"
                          }`}
                          title={field === "startDate" ? "Start date for visible chart range." : "End date for visible chart range."}
                        >
                          <span className="block text-[9px] uppercase tracking-[0.12em] text-uiTextDim">
                            {field === "startDate" ? "Start" : "End"}
                          </span>
                          {draftRange[field] || "Latest"}
                        </button>
                      ))}
                    </div>
                    <MiniCalendar
                      value={draftRange[activeDateField]}
                      onSelect={(value) => setDraftRange((prev) => ({ ...prev, [activeDateField]: value }))}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setCustomOpen(false)}
                        className="rounded-md border border-uiBorderMedium px-3 py-1.5 text-xs text-uiTextDim transition hover:bg-white/5"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPreset("CUSTOM");
                          setRange(draftRange);
                          setSyncedRange(null);
                          setCustomOpen(false);
                        }}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primaryText transition hover:bg-primaryDark"
                      >
                        Apply
                      </button>
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
                onClick={() => {
                  setSyncCharts((enabled) => !enabled);
                  setSyncedRange(null);
                }}
                className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-[7px] text-[13px] font-semibold transition ${
                  syncCharts
                    ? "border-primary/30 bg-primary/10 text-primary hover:border-primary/50 hover:text-uiTextSecondary"
                    : "border-white/10 bg-transparent text-uiTextDim hover:border-primary/25 hover:text-uiTextSecondary"
                }`}
                title="Synchronize chart crosshairs and viewport ranges"
              >
                {syncCharts ? <LinkIcon /> : <UnlinkIcon />}
                Chart Sync
              </button>
              <button
                type="button"
                onClick={() => refetch()}
                className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-[7px] text-[13px] font-semibold transition disabled:cursor-not-allowed ${
                  isFetching
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-white/10 bg-transparent text-uiTextDim hover:border-primary/25 hover:text-uiTextSecondary"
                }`}
                disabled={isFetching}
              >
                <RefreshIcon spinning={isFetching} />
                {isFetching ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1680px] px-7 py-5">
        <WarningBanner warnings={data?.warnings ?? []} />

        {kpis.length > 0 ? (
          <section className={`${data?.warnings?.length ? "mt-5" : ""} grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6`}>
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} isLoading={showSkeleton} />
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
            subtitle={`${selectedLabel} · $T`}
            description="WALCL - TGA - RRP. Core liquidity impulse."
            isLoading={showSkeleton}
            visibleRange={selectedVisibleRange}
            syncEnabled={syncCharts}
            onVisibleRangeChange={syncCharts ? handleSyncedRangeChange : undefined}
            priceFormatter={formatTrillionsAxis}
            series={[
              {
                id: "net-liq",
                label: "Net Liquidity",
                data: scalePoints(data?.series.netLiquidity, 1_000_000),
                color: { line: "#07DFC1" },
                type: "area",
                priceFormatter: formatTrillionsAxis,
                minMove: 0.01
              }
            ]}
          />
          <TimeSeriesChart
            title="M2"
            subtitle={`${selectedLabel} · $T`}
            description="FRED M2SL money supply, shown in $T."
            isLoading={showSkeleton}
            visibleRange={selectedVisibleRange}
            syncEnabled={syncCharts}
            onVisibleRangeChange={syncCharts ? handleSyncedRangeChange : undefined}
            priceFormatter={formatTrillionsAxis}
            series={[
              {
                id: "m2",
                label: "M2",
                data: scalePoints(data?.series.M2SL, 1_000),
                color: { line: "#8BE9D8" },
                priceFormatter: formatTrillionsAxis,
                minMove: 0.01
              }
            ]}
          />
          <TimeSeriesChart
            title="TGA and RRP"
            subtitle={`${selectedLabel} · $B`}
            description="TGA and RRP balances. Higher levels drain liquidity."
            isLoading={showSkeleton}
            visibleRange={selectedVisibleRange}
            syncEnabled={syncCharts}
            onVisibleRangeChange={syncCharts ? handleSyncedRangeChange : undefined}
            priceFormatter={formatBillionsAxis}
            series={[
              {
                id: "tga",
                label: "TGA",
                data: scalePoints(data?.series.WTREGEN, 1_000),
                color: { line: "#F0A04B" },
                priceScaleId: "left",
                priceFormatter: formatBillionsAxis,
                minMove: 1
              },
              {
                id: "rrp",
                label: "RRP",
                data: scalePoints(data?.series.RRPONTSYD, 1_000),
                color: { line: "#FF8A96" },
                priceScaleId: "right",
                priceFormatter: formatBillionsAxis,
                minMove: 0.01,
                lineStyle: LineStyle.Dashed
              }
            ]}
          />
          <TimeSeriesChart
            title="SPX and Liquidity vs SPX"
            subtitle={`${selectedLabel} · SPX / $B per index point`}
            description="SPX vs liquidity per index point."
            isLoading={showSkeleton}
            visibleRange={selectedVisibleRange}
            syncEnabled={syncCharts}
            onVisibleRangeChange={syncCharts ? handleSyncedRangeChange : undefined}
            priceFormatter={formatIndexAxis}
            series={[
              {
                id: "spx",
                label: "SPX",
                data: data?.series.SPX ?? [],
                color: { line: "#52F6D7" },
                priceScaleId: "left",
                priceFormatter: formatIndexAxis,
                minMove: 1
              },
              {
                id: "liq-vs-spx",
                label: "Liq/SPX",
                data: scalePoints(data?.series.liquidityVsSPX, 1_000),
                color: { line: "#029F8C" },
                priceScaleId: "right",
                priceFormatter: formatRatioAxis,
                minMove: 0.01,
                lineStyle: LineStyle.Dashed
              }
            ]}
          />
          <TimeSeriesChart
            title="Oil and DXY"
            subtitle={`${selectedLabel} · WTI/Brent left, DXY right`}
            description="Oil inflation proxy plus dollar strength."
            isLoading={showSkeleton}
            visibleRange={selectedVisibleRange}
            syncEnabled={syncCharts}
            onVisibleRangeChange={syncCharts ? handleSyncedRangeChange : undefined}
            priceFormatter={formatIndexAxis}
            series={[
              {
                id: "wti",
                label: "WTI",
                data: data?.series.WTI ?? [],
                color: { line: "#F5BC7A" },
                priceScaleId: "left",
                priceFormatter: formatIndexAxis,
                minMove: 0.1
              },
              {
                id: "brent",
                label: "Brent",
                data: data?.series.BRENT ?? [],
                color: { line: "#F0A04B" },
                priceScaleId: "left",
                priceFormatter: formatIndexAxis,
                minMove: 0.1,
                lineStyle: LineStyle.Dashed
              },
              {
                id: "dxy",
                label: "DXY",
                data: data?.series.DXY ?? [],
                color: { line: "#FF8A96" },
                priceScaleId: "right",
                priceFormatter: formatIndexAxis,
                minMove: 0.1,
                lineStyle: LineStyle.Dotted
              }
            ]}
          />
          <TimeSeriesChart
            title="Fed Funds and 2Y Yield"
            subtitle={`${selectedLabel} · %`}
            description="Policy rate and 2Y market-rate pressure."
            isLoading={showSkeleton}
            visibleRange={selectedVisibleRange}
            syncEnabled={syncCharts}
            onVisibleRangeChange={syncCharts ? handleSyncedRangeChange : undefined}
            priceFormatter={formatPercentAxis}
            series={[
              {
                id: "fedfunds",
                label: "Fed Funds",
                data: data?.series.FEDFUNDS ?? [],
                color: { line: "#1FE2C4" },
                priceScaleId: "left",
                priceFormatter: formatPercentAxis,
                minMove: 0.01
              },
              {
                id: "dgs2",
                label: "2Y Yield",
                data: data?.series.DGS2 ?? [],
                color: { line: "#91FEE6" },
                priceScaleId: "right",
                priceFormatter: formatPercentAxis,
                minMove: 0.01,
                lineStyle: LineStyle.Dashed
              }
            ]}
          />
        </section>

        {data?.regime ? (
          <section className="mt-6">
            <RegimePanel regime={data.regime} metrics={data.metrics} />
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
