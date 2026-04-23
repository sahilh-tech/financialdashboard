import { marketFixtures } from "@/lib/fixtures/marketSeries";
import { MarketDataProvider, MarketSeriesMap } from "@/lib/providers/market/types";

export class MockMarketDataProvider implements MarketDataProvider {
  public readonly name = "mock-market-provider";

  async fetchSeries(): Promise<MarketSeriesMap> {
    return {
      SPX: {
        name: "S&P 500 (mock)",
        unit: "Index points",
        frequency: "weekly",
        points: [...marketFixtures.SPX]
      },
      DXY: {
        name: "US Dollar Index (mock)",
        unit: "Index points",
        frequency: "weekly",
        points: [...marketFixtures.DXY]
      },
      WTI: {
        name: "WTI Crude Oil (mock)",
        unit: "USD per barrel",
        frequency: "weekly",
        points: [...marketFixtures.WTI]
      },
      BRENT: {
        name: "Brent Crude Oil (mock)",
        unit: "USD per barrel",
        frequency: "weekly",
        points: [...marketFixtures.BRENT]
      },
      BTC: {
        name: "Bitcoin (mock)",
        unit: "USD",
        frequency: "weekly",
        points: [...marketFixtures.BTC]
      }
    };
  }
}
