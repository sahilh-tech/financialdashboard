import { DashboardLatestMetrics } from "@/lib/calculations/metrics";
import { RegimeClassification } from "@/lib/regime/classifier";
import { ReactNode } from "react";

const tonePill: Record<RegimeClassification["riskConditions"], string> = {
  supportive: "bg-supportive/20 text-supportive border border-supportive/40",
  mixed: "bg-neutral/20 text-neutral border border-neutral/40",
  stressed: "bg-adverse/20 text-adverse border border-adverse/40"
};

const regimeValueTone: Record<string, string> = {
  expanding: "text-primary",
  flat: "text-warning",
  contracting: "text-adverse",
  rising: "text-adverse",
  neutral: "text-warning",
  easing: "text-primary",
  supportive: "text-primary",
  mixed: "text-warning",
  stressed: "text-adverse"
};

type ChangeRow = {
  key: string;
  name: string;
  currentValue: string;
  changePercent: number | null;
  changeLabel?: string;
  inverted?: boolean;
};

type RegimePanelProps = {
  regime: RegimeClassification;
  metrics: DashboardLatestMetrics | null;
};

function formatTrillionsFromMillions(value: number): string {
  return `$${(value / 1_000_000).toFixed(2)}T`;
}

function formatTrillionsFromBillions(value: number): string {
  return `$${(value / 1_000).toFixed(2)}T`;
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

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function formatChange(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatPointChange(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}pp`;
}

function changeTone(value: number | null, inverted = false): string {
  if (value === null || !Number.isFinite(value) || Math.abs(value) < 0.01) {
    return "text-uiTextDim";
  }

  const favorable = inverted ? value < 0 : value > 0;
  return favorable ? "text-primary" : "text-adverse";
}

function changeArrow(value: number | null): string {
  if (value === null || !Number.isFinite(value) || Math.abs(value) < 0.01) {
    return "—";
  }

  return value > 0 ? "▲" : "▼";
}

function buildChangeRows(metrics: DashboardLatestMetrics | null): ChangeRow[] {
  if (!metrics) {
    return [];
  }

  return [
    {
      key: "netLiquidity",
      name: "Net Liquidity",
      currentValue: formatTrillionsFromMillions(metrics.levels.netLiquidity),
      changePercent: metrics.changes4w.netLiquidity.percent
    },
    {
      key: "M2SL",
      name: "M2",
      currentValue: formatTrillionsFromBillions(metrics.levels.M2SL),
      changePercent: metrics.changes4w.M2SL.percent
    },
    {
      key: "WTREGEN",
      name: "TGA",
      currentValue: formatBillionsFromMillions(metrics.levels.WTREGEN),
      changePercent: metrics.changes4w.WTREGEN.percent
    },
    {
      key: "RRPONTSYD",
      name: "RRP",
      currentValue: formatBillionsFromMillions(metrics.levels.RRPONTSYD),
      changePercent: metrics.changes4w.RRPONTSYD.percent
    },
    {
      key: "SPX",
      name: "SPX",
      currentValue: formatNumber(metrics.levels.SPX, 0),
      changePercent: metrics.changes4w.SPX.percent
    },
    {
      key: "WTI",
      name: "WTI",
      currentValue: `$${formatNumber(metrics.levels.WTI, 2)}`,
      changePercent: metrics.changes4w.WTI.percent,
      inverted: true
    },
    {
      key: "BRENT",
      name: "Brent",
      currentValue: `$${formatNumber(metrics.levels.BRENT, 2)}`,
      changePercent: metrics.changes4w.BRENT.percent,
      inverted: true
    },
    {
      key: "DXY",
      name: "DXY",
      currentValue: formatNumber(metrics.levels.DXY, 2),
      changePercent: metrics.changes4w.DXY.percent,
      inverted: true
    },
    {
      key: "FEDFUNDS",
      name: "Fed Funds",
      currentValue: `${formatNumber(metrics.levels.FEDFUNDS, 2)}%`,
      changePercent: metrics.changes4w.FEDFUNDS.absolute,
      changeLabel: formatPointChange(metrics.changes4w.FEDFUNDS.absolute),
      inverted: true
    },
    {
      key: "DGS2",
      name: "2Y Yield",
      currentValue: `${formatNumber(metrics.levels.DGS2, 2)}%`,
      changePercent: metrics.changes4w.DGS2.absolute,
      changeLabel: formatPointChange(metrics.changes4w.DGS2.absolute),
      inverted: true
    }
  ];
}

function classifySignal(note: string): { icon: string; color: string } {
  const lower = note.toLowerCase();
  if (/(risk|tightening|elevated|sharp|outrunning|negative|stress)/.test(lower)) {
    return { icon: "⚠", color: "#F0A04B" };
  }
  if (/(exhausted|near zero|flat|curve)/.test(lower)) {
    return { icon: "ℹ", color: "#52F6D7" };
  }
  if (/(expansion|supportive|weakness)/.test(lower)) {
    return { icon: "✓", color: "#07DFC1" };
  }
  return { icon: "ℹ", color: "#52F6D7" };
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function RegimePanel({ regime, metrics }: RegimePanelProps): ReactNode {
  const rows = buildChangeRows(metrics);
  const signals = [...regime.riskNotes, ...regime.tags];

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <article className="flex min-h-[380px] flex-col rounded-2xl border border-uiBorderMedium bg-uiSurfaceGlass p-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-uiTextSecondary">● Current Regime</p>
        <div className={`mt-3 inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${tonePill[regime.riskConditions]}`}>
          {regime.riskConditions}
        </div>
        <dl className="mt-6 space-y-6 text-sm text-uiTextPrimary">
          <div className="flex justify-between gap-3">
            <dt className="text-uiTextDim">LIQUIDITY BACKDROP</dt>
            <dd className={`capitalize ${regimeValueTone[regime.liquidityBackdrop]}`}>{regime.liquidityBackdrop}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-uiTextDim">INFLATION PRESSURE</dt>
            <dd className={`capitalize ${regimeValueTone[regime.inflationPressure]}`}>{regime.inflationPressure}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-uiTextDim">RISK CONDITIONS</dt>
            <dd className={`capitalize ${regimeValueTone[regime.riskConditions]}`}>{regime.riskConditions}</dd>
          </div>
        </dl>
        <p className="mt-auto border-t border-uiBorderMedium pt-4 text-sm italic text-uiTextDim">
          Rules-based classification. Not investment advice.
        </p>
      </article>

      <article className="flex min-h-[380px] flex-col rounded-2xl border border-uiBorderMedium bg-uiSurfaceGlass p-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-uiTextSecondary">● What Changed — Last 4 Weeks</p>
        {rows.length === 0 ? (
          <p className="mt-5 text-sm text-textMuted">No complete 4-week windows available.</p>
        ) : (
          <div className="mt-5 grid grid-cols-[1fr_auto_auto] gap-x-4 text-sm">
            {rows.map((row) => (
              <div key={row.key} className="contents">
                <span className="border-b border-white/5 py-2 text-textMuted">{row.name}</span>
                <span className="border-b border-white/5 py-2 text-right font-mono text-[13px] font-semibold text-uiTextPrimary">
                  {row.currentValue}
                </span>
                <span className={`min-w-20 border-b border-white/5 py-2 text-right font-mono text-[13px] font-semibold ${changeTone(row.changePercent, row.inverted)}`}>
                  {changeArrow(row.changePercent)} {row.changeLabel ?? formatChange(row.changePercent)}
                </span>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="flex min-h-[380px] flex-col rounded-2xl border border-uiBorderMedium bg-uiSurfaceGlass p-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-uiTextSecondary">● Risk Notes & Signals</p>
        <ul className="mt-5 space-y-2 text-sm text-uiTextPrimary">
          {signals.length === 0 ? <li className="text-textMuted">No acute stress flags from current rules.</li> : null}
          {signals.map((note) => {
            const signal = classifySignal(note);
            return (
              <li key={note} className="flex gap-2">
                <span style={{ color: signal.color }}>{signal.icon}</span>
                <span>{titleCase(note)}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto rounded-xl border border-uiBorderMedium bg-[#1A3248]/70 p-4 text-sm text-uiTextDim">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-uiTextSecondary">Thresholds</p>
          <p>Liq expanding: NL 13w ROC {">"} 1% &amp; M2 {">"} 0.5%</p>
          <p>Inflation risk: WTI/Brent 4w {">"} 5% &amp; DXY 4w {">"} 1%</p>
          <p>Risk stressed: NL 13w {"<"} -1% or SPX 13w {"<"} -5%</p>
          <p>RRP exhausted: {"<"} $100B</p>
        </div>
      </article>
    </section>
  );
}
