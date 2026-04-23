import { logProviderError } from "@/lib/logging";
import { fetchFredMarketSeries } from "@/lib/providers/fred";
import { MockMarketDataProvider } from "./mock";
import { StooqMarketDataProvider } from "./stooq";
import { YahooMarketDataProvider } from "./yahoo";
import { MarketDataProvider, MarketSeriesMap } from "./types";

function hasAnyMarketPoints(data: MarketSeriesMap): boolean {
  return Object.values(data).some((series) => series.points.length > 0);
}

function buildProviderChain(): MarketDataProvider[] {
  const requestedSource = process.env.MARKET_DATA_SOURCE?.toLowerCase();
  if (requestedSource === "mock") {
    return [new MockMarketDataProvider()];
  }

  if (requestedSource === "stooq") {
    return [new StooqMarketDataProvider(), new YahooMarketDataProvider(), new MockMarketDataProvider()];
  }

  if (requestedSource === "yahoo") {
    return [new YahooMarketDataProvider(), new StooqMarketDataProvider(), new MockMarketDataProvider()];
  }

  return [new YahooMarketDataProvider(), new StooqMarketDataProvider(), new MockMarketDataProvider()];
}

export async function fetchMarketSeries(): Promise<{ provider: string; data: MarketSeriesMap }> {
  const providerChain = buildProviderChain();

  for (const provider of providerChain) {
    try {
      const data = await provider.fetchSeries();
      if (!hasAnyMarketPoints(data)) {
        logProviderError(`market:${provider.name}`, "Provider returned no usable market points.");
        continue;
      }

      const fredOverrides = await fetchFredMarketSeries();
      const mergedData = {
        ...data,
        ...fredOverrides
      };
      const providerName = Object.keys(fredOverrides).length > 0 ? `${provider.name}+fred-market` : provider.name;
      return { provider: providerName, data: mergedData };
    } catch (error) {
      logProviderError(`market:${provider.name}`, error);
    }
  }

  throw new Error("All market data providers failed.");
}
