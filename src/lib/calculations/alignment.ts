import { TimeSeriesPoint } from "@/lib/types/timeSeries";

export type AlignOptions = {
  startDate?: string;
  endDate?: string;
  stepDays?: number;
  maxStalenessDays?: number;
};

export type AlignedSeriesMap<T extends string> = Record<T, TimeSeriesPoint[]>;

function toUtcDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function toIsoDate(date: Date): TimeSeriesPoint["date"] {
  return date.toISOString().slice(0, 10) as TimeSeriesPoint["date"];
}

function buildDateGrid(startDate: string, endDate: string, stepDays: number): string[] {
  const cursor = toUtcDate(startDate);
  const maxDate = toUtcDate(endDate);
  const result: string[] = [];

  while (cursor <= maxDate) {
    result.push(toIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + stepDays);
  }

  return result;
}

function findAsOfValue(points: TimeSeriesPoint[], anchorDate: string, maxStalenessDays: number): number | null {
  const anchor = toUtcDate(anchorDate).getTime();
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    const timestamp = toUtcDate(point.date).getTime();
    if (timestamp > anchor) {
      continue;
    }

    const ageDays = (anchor - timestamp) / (24 * 60 * 60 * 1000);
    if (ageDays > maxStalenessDays) {
      return null;
    }

    return point.value;
  }

  return null;
}

function inferSharedDateWindow<T extends string>(seriesMap: Record<T, TimeSeriesPoint[]>): {
  startDate: string;
  endDate: string;
} {
  const allSeries = Object.values(seriesMap) as TimeSeriesPoint[][];
  const starts = allSeries.map((points) => points[0]?.date).filter(Boolean) as string[];
  const ends = allSeries
    .map((points) => points[points.length - 1]?.date)
    .filter(Boolean) as string[];

  if (starts.length === 0 || ends.length === 0) {
    throw new Error("Cannot align empty time series.");
  }

  return {
    startDate: starts.sort()[0],
    endDate: ends.sort().at(-1)!
  };
}

export function alignSeriesByAsOfWeeklyGrid<T extends string>(
  seriesMap: Record<T, TimeSeriesPoint[]>,
  options: AlignOptions = {}
): AlignedSeriesMap<T> {
  const { startDate: inferredStart, endDate: inferredEnd } = inferSharedDateWindow(seriesMap);
  const startDate = options.startDate ?? inferredStart;
  const endDate = options.endDate ?? inferredEnd;
  const stepDays = options.stepDays ?? 7;
  const maxStalenessDays = options.maxStalenessDays ?? 40;

  const grid = buildDateGrid(startDate, endDate, stepDays);
  const output = {} as AlignedSeriesMap<T>;

  (Object.keys(seriesMap) as T[]).forEach((seriesKey) => {
    output[seriesKey] = [];
  });

  for (const anchorDate of grid) {
    const valuesForDate = (Object.keys(seriesMap) as T[]).map((key) => ({
      key,
      value: findAsOfValue(seriesMap[key], anchorDate, maxStalenessDays)
    }));

    if (valuesForDate.some(({ value }) => value === null)) {
      continue;
    }

    valuesForDate.forEach(({ key, value }) => {
      output[key].push({
        date: anchorDate as TimeSeriesPoint["date"],
        value: value as number
      });
    });
  }

  return output;
}
