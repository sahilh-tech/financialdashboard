import { ReactNode } from "react";

type InfoTooltipProps = {
  content: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function InfoTooltip({ content, children = "?", className = "" }: InfoTooltipProps): ReactNode {
  return (
    <span className={`group/tooltip relative inline-flex ${className}`}>
      {children}
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-[80] hidden w-72 -translate-x-1/2 rounded-lg border border-primary/25 bg-[#07131f] p-3 text-left text-[12px] font-normal leading-relaxed tracking-normal text-textMuted shadow-2xl shadow-black/40 group-hover/tooltip:block group-focus-within/tooltip:block">
        {content}
      </span>
    </span>
  );
}
