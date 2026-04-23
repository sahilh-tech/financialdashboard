import { FRED_SERIES } from "@/lib/config/series";
import { macroFixtures } from "@/lib/fixtures/macroSeries";
import { logProviderError } from "@/lib/logging";
import { fredSeriesResponseSchema } from "@/lib/schemas/fred";
import { withCache } from "@/lib/server/cache";
import { NamedSeries, SeriesMap, TimeSeriesPoint } from "@/lib/types/timeSeries";

const FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations";
const FRED_TTL_MS = 15 * 60 * 1000;
const FRED_RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const FRED_MARKET_SERIES = [
  {
    key: "SPX",
    fredId: "SP500",
    label: "S&P 500 (SP500)",
    unit: "Index points",
    frequency: "daily"
  },
  {
    key: "WTI",
    fredId: "DCOILWTICO",
    label: "WTI Crude Oil (DCOILWTICO)",
    unit: "USD per barrel",
    frequency: "daily"
  },
  {
    key: "BRENT",
    fredId: "DCOILBRENTEU",
    label: "Brent Crude Oil (DCOILBRENTEU)",
    unit: "USD per barrel",
    frequency: "daily"
  }
] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseFredObservation(observation: { date: string; value: string }): TimeSeriesPoint | null {
  if (observation.value === ".") {
    return null;
  }

  const value = Number(observation.value);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid FRED numeric value "${observation.value}" at ${observation.date}.`);
  }

  return {
    date: observation.date as TimeSeriesPoint["date"],
    value
  };
}

async function fetchFredSeries({
  fredId,
  unit,
  label,
  frequency,
  valueMultiplier = 1,
  apiKey
}: {
  fredId: string;
  unit: string;
  label: string;
  frequency: NamedSeries["frequency"];
  valueMultiplier?: number;
  apiKey: string;
}): Promise<NamedSeries> {
  const url = new URL(FRED_BASE_URL);
  url.searchParams.set("series_id", fredId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "asc");

  const cacheKey = `fred:${fredId}:multiplier:${valueMultiplier}`;
  return withCache(cacheKey, FRED_TTL_MS, async () => {
    let response: Response | null = null;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });

      if (response.ok || !FRED_RETRY_STATUSES.has(response.status) || attempt === maxAttempts) {
        break;
      }

      await sleep(300 * attempt);
    }

    if (!response) {
      throw new Error(`FRED returned no response for ${fredId}.`);
    }

    if (!response.ok) {
      throw new Error(`FRED returned ${response.status} for ${fredId}.`);
    }

    const raw = await response.json();
    const parsed = fredSeriesResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`FRED payload validation failed for ${fredId}: ${parsed.error.message}`);
    }

    const points = parsed.data.observations
      .map(parseFredObservation)
      .filter((point): point is TimeSeriesPoint => point !== null)
      .map((point) => ({
        date: point.date,
        value: point.value * valueMultiplier
      }));

    return {
      name: label,
      unit,
      frequency,
      points
    };
  });
}

export async function fetchFredMacroSeries(): Promise<
  Pick<SeriesMap, "WALCL" | "WTREGEN" | "RRPONTSYD" | "M2SL" | "FEDFUNDS" | "DGS2" | "DGS10">
> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    if (process.env.ALLOW_MOCK_FRED === "true") {
      return {
        WALCL: {
          name: "Fed Balance Sheet (WALCL) [mock]",
          unit: "Millions of USD",
          frequency: "weekly",
          points: [...macroFixtures.WALCL]
        },
        WTREGEN: {
          name: "Treasury General Account (WTREGEN) [mock]",
          unit: "Millions of USD",
          frequency: "weekly",
          points: [...macroFixtures.WTREGEN]
        },
        RRPONTSYD: {
          name: "Overnight Reverse Repo (RRPONTSYD) [mock]",
          unit: "Millions of USD",
          frequency: "daily",
          points: [...macroFixtures.RRPONTSYD]
        },
        M2SL: {
          name: "M2 Money Stock (M2SL) [mock]",
          unit: "Billions of USD",
          frequency: "monthly",
          points: [...macroFixtures.M2SL]
        },
        FEDFUNDS: {
          name: "Effective Fed Funds (FEDFUNDS) [mock]",
          unit: "Percent",
          frequency: "monthly",
          points: [...macroFixtures.FEDFUNDS]
        },
        DGS2: {
          name: "2Y Treasury Yield (DGS2) [mock]",
          unit: "Percent",
          frequency: "daily",
          points: [...macroFixtures.DGS2]
        },
        DGS10: {
          name: "10Y Treasury Yield (DGS10) [mock]",
          unit: "Percent",
          frequency: "daily",
          points: [...macroFixtures.DGS10]
        }
      };
    }

    throw new Error("Missing FRED_API_KEY. Configure it in server environment variables or set ALLOW_MOCK_FRED=true.");
  }

  const entries: Array<readonly [keyof Pick<SeriesMap, "WALCL" | "WTREGEN" | "RRPONTSYD" | "M2SL" | "FEDFUNDS" | "DGS2" | "DGS10">, NamedSeries]> = [];

  for (const seriesConfig of FRED_SERIES) {
    try {
      const series = await fetchFredSeries({
        fredId: seriesConfig.fredId,
        unit: seriesConfig.unit,
        label: seriesConfig.label,
        frequency: seriesConfig.frequency,
        valueMultiplier: seriesConfig.valueMultiplier,
        apiKey
      });

      entries.push([seriesConfig.key, series] as const);
    } catch (error) {
      logProviderError(`fred:${seriesConfig.key}`, error);
      entries.push([
        seriesConfig.key,
        {
          name: `${seriesConfig.label} [unavailable]`,
          unit: seriesConfig.unit,
          frequency: seriesConfig.frequency,
          points: []
        }
      ] as const);
    }
  }

  return Object.fromEntries(entries) as Pick<
    SeriesMap,
    "WALCL" | "WTREGEN" | "RRPONTSYD" | "M2SL" | "FEDFUNDS" | "DGS2" | "DGS10"
  >;
}

export async function fetchFredMarketSeries(): Promise<Partial<Pick<SeriesMap, "SPX" | "WTI" | "BRENT">>> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return {};
  }

  const output: Partial<Pick<SeriesMap, "SPX" | "WTI" | "BRENT">> = {};

  for (const seriesConfig of FRED_MARKET_SERIES) {
    try {
      const series = await fetchFredSeries({
        fredId: seriesConfig.fredId,
        unit: seriesConfig.unit,
        label: seriesConfig.label,
        frequency: seriesConfig.frequency,
        apiKey
      });

      if (series.points.length > 0) {
        output[seriesConfig.key] = series;
      }
    } catch (error) {
      logProviderError(`fred-market:${seriesConfig.key}`, error);
    }
  }

  return output;
}
