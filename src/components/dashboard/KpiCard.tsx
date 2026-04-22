import { ReactNode } from "react";

type Tone = "supportive" | "neutral" | "adverse";

type KpiCardProps = {
  label: string;
  value: string;
  tooltip: string;
  tone?: Tone;
  changeText?: string;
};

const toneStyles: Record<Tone, string> = {
  supportive: "before:bg-[#56D8C6] text-[#56D8C6]",
  neutral: "before:bg-[#A7B2C4] text-[#A7B2C4]",
  adverse: "before:bg-[#EE6A7A] text-[#EE6A7A]"
};

export function KpiCard({ label, value, tooltip, tone = "neutral", changeText }: KpiCardProps): ReactNode {
  return (
    <article
      className={`relative min-h-[80px] rounded-[10px] border border-uiBorderMedium bg-uiSurfaceGlassDeep px-4 py-[14px] backdrop-blur-sm before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:rounded-t-[10px] ${toneStyles[tone]}`}
      title={tooltip}
      aria-label={`${label}: ${tooltip}`}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-uiTextDim">{label}</p>
      <p className="font-mono text-[20px] font-bold leading-[1.2] text-uiTextPrimary">{value}</p>
      {changeText ? <p className="mt-1 font-mono text-[11px] font-semibold leading-none">{changeText}</p> : null}
    </article>
  );
}
