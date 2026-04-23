import { logProviderError } from "@/lib/logging";
import { withCache } from "@/lib/server/cache";
import { TimeSeriesPoint } from "@/lib/types/timeSeries";
import { MarketDataProvider, MarketSeriesKey, MarketSeriesMap } from "./types";

const STOOQ_TTL_MS = 15 * 60 * 1000;

const STOOQ_SYMBOLS: Record<MarketSeriesKey, { symbol: string; name: string; unit: string }> = {
  SPX: { symbol: "^spx", name: "S&P 500", unit: "Index points" },
  DXY: { symbol: "dx.f", name: "US Dollar Index", unit: "Index points" },
  WTI: { symbol: "cl.f", name: "WTI Crude Oil", unit: "USD per barrel" },
  BRENT: { symbol: "brn.f", name: "Brent Crude Oil", unit: "USD per barrel" },
  BTC: { symbol: "btcusd", name: "Bitcoin", unit: "USD" }
};

function parseStooqCsv(csvText: string): TimeSeriesPoint[] {
  const trimmed = csvText.trim();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    throw new Error("Stooq returned HTML instead of CSV.");
  }

  const [headerLine, ...rows] = trimmed.split("\n");
  const normalizedHeader = headerLine
    ?.replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();
  if (!normalizedHeader?.includes("date") || !normalizedHeader.includes("close")) {
    throw new Error(`Unexpected Stooq CSV header: "${headerLine ?? "empty"}".`);
  }

  return rows
    .map((row) => row.split(","))
    .map((columns) => {
      const [date, , , , close] = columns;
      if (!date || !close) {
        return null;
      }

      const closeValue = Number(close);
      if (!Number.isFinite(closeValue)) {
        return null;
      }

      return {
        date: date as TimeSeriesPoint["date"],
        value: closeValue
      };
    })
    .filter((point): point is TimeSeriesPoint => point !== null)
    .sort((left, right) => left.date.localeCompare(right.date));
}

async function fetchStooqSymbol(key: MarketSeriesKey): Promise<TimeSeriesPoint[]> {
  const symbol = STOOQ_SYMBOLS[key].symbol;
  const cacheKey = `stooq:${symbol}`;
  return withCache(cacheKey, STOOQ_TTL_MS, async () => {
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Stooq returned ${response.status} for ${symbol}.`);
    }

    const csv = await response.text();
    return parseStooqCsv(csv);
  });
}

export class StooqMarketDataProvider implements MarketDataProvider {
  public readonly name = "stooq-market-provider";

  async fetchSeries(): Promise<MarketSeriesMap> {
    const keys = Object.keys(STOOQ_SYMBOLS) as MarketSeriesKey[];
    const entries = await Promise.all(
      keys.map(async (key) => {
        try {
          const points = await fetchStooqSymbol(key);
          return [
            key,
            {
              name: STOOQ_SYMBOLS[key].name,
              unit: STOOQ_SYMBOLS[key].unit,
              frequency: "daily" as const,
              points
            }
          ] as const;
        } catch (error) {
          logProviderError(`stooq:${key}`, error);
          return [
            key,
            {
              name: STOOQ_SYMBOLS[key].name,
              unit: STOOQ_SYMBOLS[key].unit,
              frequency: "daily" as const,
              points: []
            }
          ] as const;
        }
      })
    );

    return Object.fromEntries(entries) as MarketSeriesMap;
  }
}
