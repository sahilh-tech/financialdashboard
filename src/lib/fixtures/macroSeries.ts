import { TimeSeriesPoint } from "@/lib/types/timeSeries";

function generateSeries({
  startDate,
  points,
  start,
  step
}: {
  startDate: string;
  points: number;
  start: number;
  step: number;
}): TimeSeriesPoint[] {
  const seed = new Date(`${startDate}T00:00:00.000Z`);
  return Array.from({ length: points }, (_, index) => {
    const date = new Date(seed);
    date.setUTCDate(seed.getUTCDate() + index * 7);
    return {
      date: date.toISOString().slice(0, 10) as TimeSeriesPoint["date"],
      value: Number((start + step * index).toFixed(3))
    };
  });
}

export const macroFixtures = {
  WALCL: generateSeries({ startDate: "2023-01-06", points: 190, start: 8_600_000, step: 2_000 }),
  WTREGEN: generateSeries({ startDate: "2023-01-06", points: 190, start: 620_000, step: -350 }),
  RRPONTSYD: generateSeries({ startDate: "2023-01-06", points: 190, start: 2_200_000, step: -11_000 }),
  M2SL: generateSeries({ startDate: "2023-01-06", points: 190, start: 20_900, step: 5.8 }),
  FEDFUNDS: generateSeries({ startDate: "2023-01-06", points: 190, start: 5.3, step: -0.004 }),
  DGS2: generateSeries({ startDate: "2023-01-06", points: 190, start: 4.7, step: -0.003 }),
  DGS10: generateSeries({ startDate: "2023-01-06", points: 190, start: 4.1, step: -0.002 })
} as const;
