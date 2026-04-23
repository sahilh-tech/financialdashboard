import { ReactNode } from "react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

type Tone = "supportive" | "neutral" | "adverse";

type KpiCardProps = {
  label: string;
  value: string;
  tooltip: string;
  valueTooltip?: string;
  tone?: Tone;
  changeText?: string;
  changeTooltip?: string;
  isLoading?: boolean;
};

const valueToneStyles: Record<Tone, string> = {
  supportive: "text-uiTextPrimary",
  neutral: "text-uiTextPrimary",
  adverse: "text-uiTextPrimary"
};

const changeToneStyles: Record<Tone, string> = {
  supportive: "text-[#56D8C6]",
  neutral: "text-[#A7B2C4]",
  adverse: "text-[#EE6A7A]"
};

export function KpiCard({
  label,
  value,
  tooltip,
  valueTooltip,
  tone = "neutral",
  changeText,
  changeTooltip,
  isLoading = false
}: KpiCardProps): ReactNode {
  return (
    <article
      className="relative min-h-[132px] rounded-[10px] border border-uiBorderMedium bg-uiSurfaceGlassDeep px-5 py-[18px] backdrop-blur-sm transition duration-150 hover:-translate-y-px hover:border-primary/25"
      aria-label={`${label}: ${tooltip}`}
    >
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-uiTextDim">
        {label}
        <InfoTooltip
          content={
            <span>
              <span className="block font-semibold text-uiTextPrimary">{label}</span>
              <span>{tooltip}</span>
            </span>
          }
        >
          <button
            type="button"
            className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-primary/25 text-[9px] text-primary"
            aria-label={`${label} information`}
          >
            ?
          </button>
        </InfoTooltip>
      </p>
      {isLoading ? (
        <>
          <div className="dashboard-skeleton mt-4 h-8 w-28 rounded" />
          <div className="dashboard-skeleton mt-3 h-3 w-16 rounded" />
        </>
      ) : (
        <div className="flex flex-col items-start">
          <InfoTooltip content={valueTooltip ?? tooltip} className="w-fit">
            <p className={`font-mono text-[28px] font-bold leading-[1.15] ${valueToneStyles[tone]}`}>{value}</p>
          </InfoTooltip>
          {changeText ? (
            <InfoTooltip content={changeTooltip ?? "Recent percent change."} className="mt-3 w-fit">
              <p className={`font-mono text-[14px] font-semibold leading-none ${changeToneStyles[tone]}`}>{changeText}</p>
            </InfoTooltip>
          ) : null}
        </div>
      )}
    </article>
  );
}
