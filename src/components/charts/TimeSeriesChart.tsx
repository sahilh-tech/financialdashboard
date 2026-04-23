"use client";

import {
  ColorType,
  createChart,
  IChartApi,
  ISeriesApi,
  LineStyle,
  Range,
  Time,
  UTCTimestamp
} from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
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
  priceScaleId?: "left" | "right";
  priceFormatter?: (value: number) => string;
  minMove?: number;
  lineStyle?: LineStyle;
};

type TimeSeriesChartProps = {
  title: string;
  subtitle?: string;
  description?: string;
  series: ChartSeriesConfig[];
  height?: number;
  isLoading?: boolean;
  priceFormatter?: (value: number) => string;
  visibleRange?: Range<Time> | null;
  syncEnabled?: boolean;
  onVisibleRangeChange?: (range: Range<Time> | null) => void;
};

type AdaptedPoint = {
  time: UTCTimestamp;
  value: number;
};

type SyncedChartEntry = {
  chart: IChartApi;
  firstSeries: ISeriesApi<"Area"> | ISeriesApi<"Line"> | null;
  dataByTime: Map<number, number>;
};

const syncedCharts = new Set<SyncedChartEntry>();
let isApplyingCrosshairSync = false;

function toTimestamp(dateString: string): UTCTimestamp {
  return Math.floor(new Date(`${dateString}T00:00:00.000Z`).getTime() / 1000) as UTCTimestamp;
}

function isValidVisibleRange(range: Range<Time> | null | undefined): range is Range<Time> {
  return Boolean(range?.from && range?.to);
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

export function TimeSeriesChart({
  title,
  subtitle,
  description,
  series,
  height = 300,
  isLoading = false,
  priceFormatter,
  visibleRange,
  syncEnabled = false,
  onVisibleRangeChange
}: TimeSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const chartSeriesRef = useRef<Array<ISeriesApi<"Area"> | ISeriesApi<"Line">>>([]);
  const syncEntryRef = useRef<SyncedChartEntry | null>(null);
  const suppressRangeEventRef = useRef(false);
  const suppressRangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRangeRef = useRef<Range<Time> | null>(null);
  const onVisibleRangeChangeRef = useRef(onVisibleRangeChange);
  const syncEnabledRef = useRef(syncEnabled);
  const normalizedSeries = useSeriesData(series);
  const hasAnyData = normalizedSeries.some((entry) => entry.data.length > 0);
  const showDualAxis = normalizedSeries.length > 1;

  useEffect(() => {
    onVisibleRangeChangeRef.current = onVisibleRangeChange;
  }, [onVisibleRangeChange]);

  useEffect(() => {
    syncEnabledRef.current = syncEnabled;
    if (!syncEnabled) {
      syncedCharts.forEach((entry) => entry.chart.clearCrosshairPosition());
    }
  }, [syncEnabled]);

  function releaseRangeSuppressionSoon(): void {
    if (suppressRangeTimerRef.current) {
      clearTimeout(suppressRangeTimerRef.current);
    }

    suppressRangeTimerRef.current = setTimeout(() => {
      suppressRangeEventRef.current = false;
      suppressRangeTimerRef.current = null;
    }, 50);
  }

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    chartRef.current = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      layout: {
        background: { type: ColorType.Solid, color: "#091F2C" },
        textColor: "#91FEE6"
      },
      grid: {
        vertLines: { color: "rgba(7, 223, 193, 0.1)" },
        horzLines: { color: "rgba(7, 223, 193, 0.1)" }
      },
      height,
      leftPriceScale: {
        visible: showDualAxis,
        borderColor: "rgba(255,255,255,0.08)",
        scaleMargins: { top: 0.18, bottom: 0.12 }
      },
      rightPriceScale: {
        visible: true,
        borderColor: "rgba(255,255,255,0.08)",
        scaleMargins: { top: 0.18, bottom: 0.12 }
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.12)",
        timeVisible: true,
        rightOffset: 0,
        barSpacing: 8,
        fixLeftEdge: false,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: true
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true
      },
      handleScroll: {
        horzTouchDrag: true,
        mouseWheel: true,
        pressedMouseMove: true,
        vertTouchDrag: false
      },
      localization: { priceFormatter }
    });

    syncEntryRef.current = {
      chart: chartRef.current,
      firstSeries: null,
      dataByTime: new Map()
    };
    syncedCharts.add(syncEntryRef.current);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chartRef.current?.applyOptions({ width: entry.contentRect.width });
      }
    });

    resizeObserver.observe(containerRef.current);

    const handleVisibleRangeChange = (range: Range<Time> | null) => {
      if (suppressRangeEventRef.current) {
        return;
      }
      if (
        lastRangeRef.current?.from === range?.from &&
        lastRangeRef.current?.to === range?.to
      ) {
        return;
      }
      lastRangeRef.current = range;
      onVisibleRangeChangeRef.current?.(range);
    };

    chartRef.current.timeScale().subscribeVisibleTimeRangeChange(handleVisibleRangeChange);

    const handleCrosshairMove = (param: { time?: Time }) => {
      if (!syncEnabledRef.current || isApplyingCrosshairSync || !param.time) {
        if (syncEnabledRef.current && !param.time) {
          syncedCharts.forEach((entry) => {
            if (entry.chart !== chartRef.current) {
              entry.chart.clearCrosshairPosition();
            }
          });
        }
        return;
      }

      isApplyingCrosshairSync = true;
      const timestamp = typeof param.time === "number" ? param.time : Number.NaN;
      syncedCharts.forEach((entry) => {
        if (entry.chart === chartRef.current || !entry.firstSeries || !Number.isFinite(timestamp)) {
          return;
        }

        const value = entry.dataByTime.get(timestamp);
        if (value === undefined) {
          entry.chart.clearCrosshairPosition();
          return;
        }

        entry.chart.setCrosshairPosition(value, param.time!, entry.firstSeries);
      });
      isApplyingCrosshairSync = false;
    };

    chartRef.current.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chartRef.current?.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleRangeChange);
      chartRef.current?.unsubscribeCrosshairMove(handleCrosshairMove);
      if (suppressRangeTimerRef.current) {
        clearTimeout(suppressRangeTimerRef.current);
        suppressRangeTimerRef.current = null;
      }
      if (syncEntryRef.current) {
        syncedCharts.delete(syncEntryRef.current);
        syncEntryRef.current = null;
      }
      resizeObserver.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
      chartSeriesRef.current = [];
    };
  }, [height, priceFormatter, showDualAxis]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    chartSeriesRef.current.forEach((entry) => {
      chart.removeSeries(entry);
    });
    chartSeriesRef.current = [];

    const firstSeriesDataByTime = new Map<number, number>();

    normalizedSeries.forEach((seriesConfig, index) => {
      const mappedData: AdaptedPoint[] = seriesConfig.data.map((point) => ({
        time: toTimestamp(point.date),
        value: point.value
      }));
      const priceScaleId = seriesConfig.priceScaleId ?? (showDualAxis && index === 0 ? "left" : "right");
      const seriesOptions = {
        priceScaleId,
        priceFormat: {
          type: "custom" as const,
          formatter: seriesConfig.priceFormatter ?? priceFormatter ?? ((value: number) => value.toFixed(2)),
          minMove: seriesConfig.minMove ?? 0.01
        }
      };

      if (index === 0) {
        mappedData.forEach((point) => firstSeriesDataByTime.set(point.time, point.value));
      }

      if (seriesConfig.type === "area") {
        const areaSeries = chart.addAreaSeries({
          lineColor: seriesConfig.color.line,
          topColor: seriesConfig.color.top ?? "rgba(40, 199, 111, 0.25)",
          bottomColor: seriesConfig.color.bottom ?? "rgba(40, 199, 111, 0.02)",
          ...seriesOptions
        });
        areaSeries.setData(mappedData);
        chartSeriesRef.current.push(areaSeries);
        if (index === 0 && syncEntryRef.current) {
          syncEntryRef.current.firstSeries = areaSeries;
          syncEntryRef.current.dataByTime = firstSeriesDataByTime;
        }
        return;
      }

      const lineSeries = chart.addLineSeries({
        color: seriesConfig.color.line,
        lineWidth: 2,
        lineStyle: seriesConfig.lineStyle ?? LineStyle.Solid,
        ...seriesOptions
      });
      lineSeries.setData(mappedData);
      chartSeriesRef.current.push(lineSeries);
      if (index === 0 && syncEntryRef.current) {
        syncEntryRef.current.firstSeries = lineSeries;
        syncEntryRef.current.dataByTime = firstSeriesDataByTime;
      }
    });

    if (hasAnyData && isValidVisibleRange(visibleRange)) {
      suppressRangeEventRef.current = true;
      chart.timeScale().setVisibleRange(visibleRange);
      releaseRangeSuppressionSoon();
    } else if (hasAnyData) {
      chart.timeScale().fitContent();
    }
  }, [hasAnyData, normalizedSeries]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    suppressRangeEventRef.current = true;
    if (hasAnyData && isValidVisibleRange(visibleRange)) {
      chart.timeScale().setVisibleRange(visibleRange);
    } else if (hasAnyData) {
      chart.timeScale().fitContent();
    }
    releaseRangeSuppressionSoon();
  }, [hasAnyData, visibleRange]);

  function resetView(): void {
    suppressRangeEventRef.current = true;
    chartRef.current?.timeScale().fitContent();
    queueMicrotask(() => {
      suppressRangeEventRef.current = false;
      onVisibleRangeChangeRef.current?.(null);
    });
  }

  return (
    <section className="group rounded-xl border border-uiBorderMedium bg-uiSurfaceGlassDeep px-5 pb-5 pt-5 backdrop-blur-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-uiTextSecondary">{title}</h3>
              {description ? (
                <InfoTooltip content={description}>
                  <button
                    type="button"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-primary/30 text-[10px] font-semibold text-primary"
                    aria-label={`${title} chart information`}
                  >
                    ?
                  </button>
                </InfoTooltip>
              ) : null}
          </div>
          {subtitle ? <p className="text-[10px] text-uiTextDim">{subtitle}</p> : null}
          {showDualAxis ? (
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-uiTextDim">
              {normalizedSeries.map((entry, index) => {
                const axis = entry.priceScaleId ?? (index === 0 ? "left" : "right");
                const dashed = entry.lineStyle === LineStyle.Dashed || index > 0;
                return (
                  <span key={entry.id} className="flex items-center gap-1.5">
                    <span
                      className={`inline-block w-5 border-t-2 ${dashed ? "border-dashed" : "border-solid"}`}
                      style={{ borderColor: entry.color.line }}
                    />
                    {entry.label} ({axis})
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={resetView}
          className="rounded-md border border-uiBorderMedium px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-uiTextDim opacity-0 transition hover:border-primary/50 hover:text-primary focus:opacity-100 group-hover:opacity-100"
          title={syncEnabled ? "Reset this chart and synced viewport" : "Reset this chart"}
        >
          Reset
        </button>
      </div>
      <div className="relative overflow-hidden rounded-lg bg-[#081f2b] p-3">
        <div ref={containerRef} className="w-full overflow-hidden rounded-md" />
        {isLoading ? (
          <div className="pointer-events-none absolute inset-3 z-10 overflow-hidden rounded-md bg-[#091F2C]">
            <div className="dashboard-skeleton h-full w-full opacity-95" />
          </div>
        ) : null}
      </div>
      {!hasAnyData && !isLoading ? <p className="mt-2 text-xs text-textMuted">No data available for this panel.</p> : null}
    </section>
  );
}
