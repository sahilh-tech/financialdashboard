"use client";

import {
  ColorType,
  createChart,
  IChartApi,
  ISeriesApi,
  UTCTimestamp
} from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";
import { TimeSeriesPoint } from "@/lib/types/timeSeries";

type ChartPoint = Pick<TimeSeriesPoint, "value"> & {
  date: string;
};

type SeriesColor = {
  line: string;
  top?: string;
  bottom?: string;
};

type ChartSeriesConfig = {
  id: string;
  label: string;
  data: ChartPoint[];
  color: SeriesColor;
  type?: "line" | "area";
};

type TimeSeriesChartProps = {
  title: string;
  subtitle?: string;
  series: ChartSeriesConfig[];
  height?: number;
};

type AdaptedPoint = {
  time: UTCTimestamp;
  value: number;
};

function toTimestamp(dateString: string): UTCTimestamp {
  return Math.floor(new Date(`${dateString}T00:00:00.000Z`).getTime() / 1000) as UTCTimestamp;
}

function useSeriesData(series: ChartSeriesConfig[]): ChartSeriesConfig[] {
  return useMemo(
    () =>
      series.map((config) => ({
        ...config,
        data: config.data.filter((point) => Number.isFinite(point.value))
      })),
    [series]
  );
}

export function TimeSeriesChart({ title, subtitle, series, height = 270 }: TimeSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const chartSeriesRef = useRef<Array<ISeriesApi<"Area"> | ISeriesApi<"Line">>>([]);
  const normalizedSeries = useSeriesData(series);
  const hasAnyData = normalizedSeries.some((entry) => entry.data.length > 0);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    chartRef.current = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#091F2C" },
        textColor: "#91FEE6"
      },
      grid: {
        vertLines: { color: "rgba(7, 223, 193, 0.1)" },
        horzLines: { color: "rgba(7, 223, 193, 0.1)" }
      },
      height,
      rightPriceScale: { borderColor: "rgba(255,255,255,0.12)" },
      timeScale: {
        borderColor: "rgba(255,255,255,0.12)",
        timeVisible: true
      }
    });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chartRef.current?.applyOptions({ width: entry.contentRect.width });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
      chartSeriesRef.current = [];
    };
  }, [height]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    chartSeriesRef.current.forEach((entry) => {
      chart.removeSeries(entry);
    });
    chartSeriesRef.current = [];

    normalizedSeries.forEach((seriesConfig) => {
      const mappedData: AdaptedPoint[] = seriesConfig.data.map((point) => ({
        time: toTimestamp(point.date),
        value: point.value
      }));

      if (seriesConfig.type === "area") {
        const areaSeries = chart.addAreaSeries({
          lineColor: seriesConfig.color.line,
          topColor: seriesConfig.color.top ?? "rgba(40, 199, 111, 0.25)",
          bottomColor: seriesConfig.color.bottom ?? "rgba(40, 199, 111, 0.02)"
        });
        areaSeries.setData(mappedData);
        chartSeriesRef.current.push(areaSeries);
        return;
      }

      const lineSeries = chart.addLineSeries({
        color: seriesConfig.color.line,
        lineWidth: 2
      });
      lineSeries.setData(mappedData);
      chartSeriesRef.current.push(lineSeries);
    });

    chart.timeScale().fitContent();
  }, [normalizedSeries]);

  return (
    <section className="rounded-xl border border-uiBorderMedium bg-uiSurfaceGlassDeep px-5 pb-2 pt-5 backdrop-blur-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_6px_rgba(7,223,193,0.45)]" />
        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-uiTextSecondary">{title}</h3>
          {subtitle ? <p className="text-[10px] text-uiTextDim">{subtitle}</p> : null}
        </div>
      </div>
      <div ref={containerRef} className="w-full" />
      {!hasAnyData ? <p className="mt-2 text-xs text-textMuted">No data available for this panel.</p> : null}
    </section>
  );
}
