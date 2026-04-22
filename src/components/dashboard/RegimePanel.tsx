import { RegimeClassification } from "@/lib/regime/classifier";
import { ReactNode } from "react";

const tonePill: Record<RegimeClassification["riskConditions"], string> = {
  supportive: "bg-supportive/20 text-supportive border border-supportive/40",
  mixed: "bg-neutral/20 text-neutral border border-neutral/40",
  stressed: "bg-adverse/20 text-adverse border border-adverse/40"
};

type RegimePanelProps = {
  regime: RegimeClassification;
  whatChanged4w: string[];
};

export function RegimePanel({ regime, whatChanged4w }: RegimePanelProps): ReactNode {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <article className="rounded-2xl border border-uiBorderMedium bg-uiSurfaceGlass p-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-uiTextSecondary">● Current Regime</p>
        <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium ${tonePill[regime.riskConditions]}`}>
          {regime.riskConditions}
        </div>
        <dl className="mt-6 space-y-6 text-sm text-uiTextPrimary">
          <div className="flex justify-between gap-3">
            <dt className="text-uiTextDim">LIQUIDITY BACKDROP</dt>
            <dd className="capitalize">{regime.liquidityBackdrop}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-uiTextDim">INFLATION PRESSURE</dt>
            <dd className="capitalize">{regime.inflationPressure}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-uiTextDim">RISK CONDITIONS</dt>
            <dd className="capitalize">{regime.riskConditions}</dd>
          </div>
        </dl>
        <p className="mt-6 border-t border-uiBorderMedium pt-4 text-sm italic text-uiTextDim">
          Rules-based classification. Not investment advice.
        </p>
      </article>

      <article className="rounded-2xl border border-uiBorderMedium bg-uiSurfaceGlass p-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-uiTextSecondary">● What Changed — Last 4 Weeks</p>
        <ul className="mt-5 space-y-3 text-sm text-uiTextPrimary">
          {whatChanged4w.length === 0 ? <li className="text-textMuted">No complete 4-week windows available.</li> : null}
          {whatChanged4w.map((entry) => (
            <li key={entry} className="border-b border-uiBorderMedium pb-2 last:border-b-0">
              {entry}
            </li>
          ))}
        </ul>
      </article>

      <article className="rounded-2xl border border-uiBorderMedium bg-uiSurfaceGlass p-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-uiTextSecondary">● Risk Notes & Signals</p>
        <ul className="mt-5 space-y-2 text-sm text-uiTextPrimary">
          {regime.riskNotes.length === 0 ? <li className="text-textMuted">No acute stress flags from current rules.</li> : null}
          {regime.riskNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
          {regime.tags.map((tag) => (
            <li key={tag} className="text-uiTextDim">
              • {tag}
            </li>
          ))}
        </ul>
        <div className="mt-5 rounded-xl border border-uiBorderMedium bg-[#1A3248]/70 p-4 text-sm text-uiTextDim">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-uiTextSecondary">Thresholds</p>
          <p>Liq expanding: NL 13w ROC {">"} 1% &amp; M2 {">"} 0.5%</p>
          <p>Inflation risk: WTI 4w {">"} 5% &amp; DXY 4w {">"} 1%</p>
          <p>Risk stressed: NL 13w {"<"} -1% or SPX 13w {"<"} -5%</p>
          <p>RRP exhausted: {"<"} $100B</p>
        </div>
      </article>
    </section>
  );
}
