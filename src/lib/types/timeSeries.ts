export type IsoDateString = `${number}-${number}-${number}`;

export type TimeSeriesPoint = {
  date: IsoDateString;
  value: number;
};

export type NamedSeries = {
  name: string;
  unit: string;
  frequency: "daily" | "weekly" | "monthly";
  points: TimeSeriesPoint[];
};

export type SeriesKey =
  | "WALCL"
  | "WTREGEN"
  | "RRPONTSYD"
  | "M2SL"
  | "FEDFUNDS"
  | "DGS2"
  | "DGS10"
  | "SPX"
  | "DXY"
  | "WTI"
  | "BRENT"
  | "BTC";

export type SeriesMap = Record<SeriesKey, NamedSeries>;
