import { TimeSeriesPoint } from "@/lib/types/timeSeries";

function generateWeeklySeries({
  startDate,
  weeks,
  startValue,
  weeklyDrift,
  amplitude
}: {
  startDate: Date;
  weeks: number;
  startValue: number;
  weeklyDrift: number;
  amplitude: number;
}): TimeSeriesPoint[] {
  return Array.from({ length: weeks }, (_, week) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + week * 7);
    const value = startValue + week * weeklyDrift + Math.sin(week / 4) * amplitude;
    return {
      date: date.toISOString().slice(0, 10) as TimeSeriesPoint["date"],
      value: Number(value.toFixed(3))
    };
  });
}

const seedDate = new Date("2023-01-06T00:00:00.000Z");

export const marketFixtures = {
  SPX: generateWeeklySeries({
    startDate: seedDate,
    weeks: 190,
    startValue: 3800,
    weeklyDrift: 8.2,
    amplitude: 90
  }),
  DXY: generateWeeklySeries({
    startDate: seedDate,
    weeks: 190,
    startValue: 101,
    weeklyDrift: -0.02,
    amplitude: 2.4
  }),
  WTI: generateWeeklySeries({
    startDate: seedDate,
    weeks: 190,
    startValue: 78,
    weeklyDrift: 0.03,
    amplitude: 5.2
  }),
  BTC: generateWeeklySeries({
    startDate: seedDate,
    weeks: 190,
    startValue: 22000,
    weeklyDrift: 180,
    amplitude: 3800
  })
} as const;
