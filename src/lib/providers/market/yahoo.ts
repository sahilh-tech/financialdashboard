import { z } from "zod";
import { logProviderError } from "@/lib/logging";
import { withCache } from "@/lib/server/cache";
import { TimeSeriesPoint } from "@/lib/types/timeSeries";
import { MarketDataProvider, MarketSeriesKey, MarketSeriesMap } from "./types";

const YAHOO_TTL_MS = 15 * 60 * 1000;

const YAHOO_SYMBOLS: Record<MarketSeriesKey, { symbol: string; name: string; unit: string }> = {
  SPX: { symbol: "^GSPC", name: "S&P 500", unit: "Index points" },
  DXY: { symbol: "DX-Y.NYB", name: "US Dollar Index", unit: "Index points" },
  WTI: { symbol: "CL=F", name: "WTI Crude Oil", unit: "USD per barrel" },
  BRENT: { symbol: "BZ=F", name: "Brent Crude Oil", unit: "USD per barrel" },
  BTC: { symbol: "BTC-USD", name: "Bitcoin", unit: "USD" }
};

const yahooResponseSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          timestamp: z.array(z.number()),
          indicators: z.object({
            quote: z.array(
              z.object({
                close: z.array(z.number().nullable())
              })
            )
          })
        })
      )
      .nullable(),
    error: z.unknown().nullable()
  })
});

function toIsoDate(timestampSeconds: number): TimeSeriesPoint["date"] {
  return new Date(timestampSeconds * 1000).toISOString().slice(0, 10) as TimeSeriesPoint["date"];
}

async function fetchYahooSymbol(key: MarketSeriesKey): Promise<TimeSeriesPoint[]> {
  const symbol = YAHOO_SYMBOLS[key].symbol;
  const cacheKey = `yahoo:${symbol}:range:max`;

  return withCache(cacheKey, YAHOO_TTL_MS, async () => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=max`;
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Yahoo returned ${response.status} for ${symbol}.`);
    }

    const raw = await response.json();
    const parsed = yahooResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Yahoo payload validation failed for ${symbol}: ${parsed.error.message}`);
    }

    const result = parsed.data.chart.result?.[0];
    const closes = result?.indicators.quote[0]?.close ?? [];
    const timestamps = result?.timestamp ?? [];
    const points: TimeSeriesPoint[] = [];

    for (let index = 0; index < timestamps.length; index += 1) {
      const ts = timestamps[index];
      const close = closes[index];
      if (!Number.isFinite(ts) || close === null || !Number.isFinite(close)) {
        continue;
      }

      points.push({
        date: toIsoDate(ts),
        value: close
      });
    }

    return points.sort((left, right) => left.date.localeCompare(right.date));
  });
}

export class YahooMarketDataProvider implements MarketDataProvider {
  public readonly name = "yahoo-market-provider";

  async fetchSeries(): Promise<MarketSeriesMap> {
    const keys = Object.keys(YAHOO_SYMBOLS) as MarketSeriesKey[];
    const output = {} as MarketSeriesMap;

    for (const key of keys) {
      try {
        const points = await fetchYahooSymbol(key);
        output[key] = {
          name: YAHOO_SYMBOLS[key].name,
          unit: YAHOO_SYMBOLS[key].unit,
          frequency: "daily",
          points
        };
      } catch (error) {
        logProviderError(`yahoo:${key}`, error);
        output[key] = {
          name: YAHOO_SYMBOLS[key].name,
          unit: YAHOO_SYMBOLS[key].unit,
          frequency: "daily",
          points: []
        };
      }
    }

    return output;
  }
}
