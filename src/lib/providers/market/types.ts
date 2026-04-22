import { NamedSeries, SeriesMap } from "@/lib/types/timeSeries";

export type MarketSeriesKey = "SPX" | "DXY" | "WTI" | "BTC";
export type MarketSeriesMap = Pick<SeriesMap, MarketSeriesKey>;

export interface MarketDataProvider {
  readonly name: string;
  fetchSeries(): Promise<MarketSeriesMap>;
}

export type MarketProviderSeriesConfig = {
  key: MarketSeriesKey;
  label: string;
  unit: string;
  symbol: string;
  frequency: NamedSeries["frequency"];
};
