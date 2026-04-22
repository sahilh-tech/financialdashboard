import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  CartesianGrid,
  ComposedChart,
  Line,
  Brush,
  ReferenceArea,
} from "recharts";
import { RefreshCw, Calendar, ChevronDown } from "lucide-react";

// ─── SSH TECH DESIGN TOKENS ────────────────────────────────────────────────────
const T = {
  primary: "#07DFC1",
  primaryLight: "#1FE2C4",
  primaryDark: "#029F8C",
  secondary: "#067F71",
  accent: "#52F6D7",
  bgHero: "#0b0c10",
  bgElevated: "#0e1a24",
  bgSurface: "#091F2C",
  bgDepth: "#0F2E3D",
  bgBase: "#0E534C",
  text: "#EFFEEB",
  textSoft: "#91FEE6",
  textMuted: "#dde3e9",
  textDim: "#8a9bae",
  error: "#FF5C6C",
  errorLight: "#FF8A96",
  warning: "#F0A04B",
  warningLight: "#F5BC7A",
  success: "#07DFC1",
  divider: "rgba(7, 223, 193, 0.15)",
  glass: "rgba(9, 31, 44, 0.75)",
  glassDark: "rgba(9, 31, 44, 0.9)",
  borderSubtle: "rgba(255, 255, 255, 0.05)",
  borderLight: "rgba(255, 255, 255, 0.08)",
  borderMed: "rgba(255, 255, 255, 0.12)",
  overlay5: "rgba(255, 255, 255, 0.05)",
  overlay8: "rgba(255, 255, 255, 0.08)",
};

// ─── GENERATE 3 YEARS OF WEEKLY MOCK DATA ──────────────────────────────────────
function generateDates(n, startDate = "2022-06-01") {
  const dates = [];
  let d = new Date(startDate);
  for (let i = 0; i < n; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 7);
  }
  return dates;
}

function walkSeries(start, n, vol = 0.01, drift = 0.0005, seed = 1) {
  let s = seed;
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
  const arr = [start];
  for (let i = 1; i < n; i++) {
    arr.push(arr[i - 1] * (1 + drift + (rand() - 0.48) * vol));
  }
  return arr;
}

const N = 156; // ~3 years weekly
const dates = generateDates(N);
const walcl = walkSeries(7750000, N, 0.003, 0.0003, 42);
const tga = walkSeries(750000, N, 0.02, -0.0005, 77);
const rrp = walkSeries(2200000, N, 0.018, -0.006, 13);
const m2 = walkSeries(21500000, N, 0.002, 0.0003, 99);
const fedfunds = walkSeries(1.58, N, 0.012, 0.008, 55);
const dgs2 = walkSeries(2.95, N, 0.01, 0.005, 61);
const dgs10 = walkSeries(2.98, N, 0.008, 0.003, 23);
const spx = walkSeries(3900, N, 0.014, 0.002, 37);
const dxy = walkSeries(102.0, N, 0.006, 0.0003, 88);
const wti = walkSeries(108.0, N, 0.018, -0.002, 44);
const btc = walkSeries(29000, N, 0.03, 0.004, 66);

const netLiq = walcl.map((w, i) => w - tga[i] - rrp[i]);
const liqVsSpx = netLiq.map((nl, i) => nl / spx[i]);

function roc(arr, period) {
  return arr.map((v, i) =>
    i < period ? null : ((v - arr[i - period]) / arr[i - period]) * 100,
  );
}

const fullData = dates.map((d, i) => ({
  date: d,
  dateShort: d.slice(5),
  idx: i,
  walcl: walcl[i],
  tga: tga[i],
  rrp: rrp[i],
  m2: m2[i],
  fedfunds: fedfunds[i],
  dgs2: dgs2[i],
  dgs10: dgs10[i],
  spx: spx[i],
  dxy: dxy[i],
  wti: wti[i],
  btc: btc[i],
  netLiq: netLiq[i],
  liqVsSpx: liqVsSpx[i],
  netLiq4w: roc(netLiq, 4)[i],
  netLiq13w: roc(netLiq, 13)[i],
  m2_4w: roc(m2, 4)[i],
  m2_13w: roc(m2, 13)[i],
  spx4w: roc(spx, 4)[i],
  spx13w: roc(spx, 13)[i],
  dxy4w: roc(dxy, 4)[i],
  dxy13w: roc(dxy, 13)[i],
  wti4w: roc(wti, 4)[i],
  wti13w: roc(wti, 13)[i],
}));

// ─── HELPERS ───────────────────────────────────────────────────────────────────
const fmtB = (v) => "$" + (v / 1e6).toFixed(2) + "T";
const fmtM = (v) => "$" + (v / 1e3).toFixed(0) + "B";
const fmtPct = (v) =>
  v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(2) + "%";
const fmtR = (v) => v.toFixed(2) + "%";
const fmtP = (v) => v.toFixed(0);
const fmtD = (v) => v.toFixed(2);
const fmtDol = (v) => "$" + v.toFixed(2);

const tooltips = {
  "Net Liquidity":
    "Fed balance sheet (WALCL) minus TGA minus RRP. Proxy for money flowing into markets.",
  "13w ΔNet Liq":
    "13-week rate of change in net liquidity. Positive = expanding liquidity.",
  M2: "M2 money supply — broadest commonly tracked money measure.",
  "13w ΔM2": "13-week rate of change in M2. Tracks credit creation pace.",
  TGA: "Treasury General Account. Drawdowns inject liquidity into markets.",
  RRP: "Reverse Repo. Declines release liquidity back into the system.",
  "Fed Funds": "Federal Funds effective rate — the Fed's primary policy rate.",
  "2Y Yield":
    "2-year Treasury yield — market's expectation of near-term rate path.",
  DXY: "US Dollar Index. Strength tightens global financial conditions.",
  WTI: "West Texas Intermediate crude. Sharp rises signal inflation pressure.",
  SPX: "S&P 500 index — broad US equity benchmark.",
};

const regimeColors = {
  expanding: T.primary,
  flat: T.warning,
  contracting: T.error,
  rising: T.error,
  neutral: T.warning,
  easing: T.primary,
  supportive: T.primary,
  mixed: T.warning,
  stressed: T.error,
};

// ─── REGIME + CHANGES (parameterized by data window) ───────────────────────────
function classifyRegime(data, allVisible) {
  if (!data)
    return {
      liquidity: "flat",
      inflation: "neutral",
      risk: "mixed",
      notes: [],
    };
  const nl13 = data.netLiq13w ?? 0;
  const m213 = data.m2_13w ?? 0;
  const wti4 = data.wti4w ?? 0;
  const dxy4 = data.dxy4w ?? 0;
  const spx13 = data.spx13w ?? 0;
  const ref =
    allVisible.length >= 14
      ? allVisible[allVisible.length - 14]
      : allVisible[0];
  const lvsChg = ref
    ? ((data.liqVsSpx - ref.liqVsSpx) / ref.liqVsSpx) * 100
    : 0;

  let liquidity = "flat";
  if (nl13 > 1.0 && m213 > 0.5) liquidity = "expanding";
  else if (nl13 < -1.0 || m213 < -0.5) liquidity = "contracting";

  let inflation = "neutral";
  if (wti4 > 5 && dxy4 > 1) inflation = "rising";
  else if (wti4 < -3 && dxy4 < -1) inflation = "easing";

  let risk = "mixed";
  if (nl13 > 1 && spx13 > 3 && lvsChg > -2) risk = "supportive";
  else if (nl13 < -1 || spx13 < -5) risk = "stressed";

  const notes = [];
  if (spx13 > 5 && lvsChg < -2)
    notes.push("⚠ Market may be outrunning liquidity support");
  if (data.rrp < 100000) notes.push("ℹ RRP tailwind mostly exhausted");
  if (wti4 > 8) notes.push("⚠ Sharp oil rally — inflation risk rising");
  if (nl13 > 2 && m213 > 1) notes.push("✓ Strong dual liquidity expansion");
  if (data.dgs2 > 5.0) notes.push("⚠ 2Y yield elevated — restrictive policy");
  if (Math.abs(data.dgs10 - data.dgs2) < 0.1)
    notes.push("ℹ Yield curve near flat");
  if (dxy4 > 2)
    notes.push("⚠ DXY strengthening — tightening financial conditions");
  if (dxy4 < -2) notes.push("✓ Dollar weakness — supportive for risk");
  return { liquidity, inflation, risk, notes };
}

function whatChanged(curr, prev) {
  if (!curr || !prev) return [];
  const changes = [];
  const diff = (name, field, fmt = (v) => v.toFixed(2)) => {
    const c = curr[field],
      p = prev[field];
    if (c == null || p == null) return;
    const pct = ((c - p) / Math.abs(p)) * 100;
    changes.push({
      name,
      current: fmt(c),
      pct: (pct > 0 ? "+" : "") + pct.toFixed(1) + "%",
      positive: pct > 0,
    });
  };
  diff("Net Liquidity", "netLiq", (v) => "$" + (v / 1e6).toFixed(0) + "M");
  diff("M2", "m2", (v) => "$" + (v / 1e6).toFixed(1) + "M");
  diff("TGA", "tga", (v) => "$" + (v / 1e3).toFixed(0) + "B");
  diff("RRP", "rrp", (v) => "$" + (v / 1e3).toFixed(0) + "B");
  diff("SPX", "spx", (v) => v.toFixed(0));
  diff("DXY", "dxy", (v) => v.toFixed(2));
  diff("WTI", "wti", (v) => "$" + v.toFixed(2));
  diff("Fed Funds", "fedfunds", (v) => v.toFixed(2) + "%");
  diff("2Y Yield", "dgs2", (v) => v.toFixed(2) + "%");
  return changes;
}

// ─── CHART TOOLTIP ─────────────────────────────────────────────────────────────
function ChartTooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: T.glassDark,
        border: `1px solid ${T.borderMed}`,
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      }}
    >
      <div style={{ color: T.textDim, marginBottom: 6, fontSize: 11 }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 3,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: p.color,
              display: "inline-block",
            }}
          />
          <span style={{ color: T.textMuted }}>{p.name}:</span>
          <span style={{ color: T.text, fontWeight: 600 }}>
            {typeof p.value === "number"
              ? Math.abs(p.value) > 10000
                ? (p.value / 1e6).toFixed(2) + "T"
                : p.value.toFixed(2)
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI CARD ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, change, tooltip, invertColor }) {
  const [showTip, setShowTip] = useState(false);
  const changeVal = parseFloat(change);
  const isInvert = invertColor;
  const changeColor = isNaN(changeVal)
    ? T.textDim
    : isInvert
      ? changeVal > 0
        ? T.error
        : T.primary
      : changeVal > 0
        ? T.primary
        : T.error;
  return (
    <div
      style={{
        background: T.glassDark,
        border: `1px solid ${T.borderLight}`,
        borderRadius: 10,
        padding: "14px 16px",
        position: "relative",
        overflow: "hidden",
        cursor: "default",
        transition: "border-color 0.2s",
      }}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: changeColor,
          opacity: 0.6,
        }}
      />
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          color: T.textDim,
          marginBottom: 6,
          fontFamily: "'Exo 2'",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
          color: T.text,
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      {change && change !== "—" && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            marginTop: 4,
            fontFamily: "'JetBrains Mono', monospace",
            color: changeColor,
          }}
        >
          {changeVal > 0 ? "▲" : "▼"} {change}
        </div>
      )}
      {showTip && tooltip && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: T.bgHero,
            border: `1px solid ${T.borderMed}`,
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: T.textMuted,
            width: 240,
            zIndex: 999,
            lineHeight: 1.5,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            fontFamily: "'Exo 2'",
            pointerEvents: "none",
          }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}

// ─── CHART PANEL ───────────────────────────────────────────────────────────────
function ChartPanel({ title, dotColor, children }) {
  return (
    <div
      style={{
        background: T.glassDark,
        border: `1px solid ${T.borderLight}`,
        borderRadius: 12,
        padding: "20px 20px 8px",
        position: "relative",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          color: T.textSoft,
          marginBottom: 16,
          fontFamily: "'Exo 2'",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor || T.primary,
            display: "inline-block",
            boxShadow: `0 0 6px ${dotColor || T.primary}60`,
          }}
        />
        {title}
      </div>
      <div style={{ width: "100%", height: 270 }}>{children}</div>
    </div>
  );
}

// ─── AREA CHART ────────────────────────────────────────────────────────────────
function AreaChartPanel({ data, dataKey, color }) {
  const gradId = `grad-${dataKey}-${color.replace("#", "")}`;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          stroke={T.borderSubtle}
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: T.textDim, fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: T.borderSubtle }}
          tickFormatter={(v) => v?.slice(5)}
          interval="preserveStartEnd"
          minTickGap={50}
        />
        <YAxis
          tick={{ fill: T.textDim, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={58}
          tickFormatter={(v) =>
            Math.abs(v) >= 1e6
              ? (v / 1e6).toFixed(1) + "T"
              : Math.abs(v) >= 1e3
                ? (v / 1e3).toFixed(0) + "B"
                : v.toFixed(1)
          }
          domain={["auto", "auto"]}
        />
        <ReTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradId})`}
          dot={false}
          name={dataKey}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── DUAL LINE CHART ───────────────────────────────────────────────────────────
function DualLinePanel({ data, key1, key2, color1, color2, name1, name2 }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <CartesianGrid
          stroke={T.borderSubtle}
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: T.textDim, fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: T.borderSubtle }}
          tickFormatter={(v) => v?.slice(5)}
          interval="preserveStartEnd"
          minTickGap={50}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: T.textDim, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={55}
          tickFormatter={(v) =>
            Math.abs(v) >= 1e6
              ? (v / 1e6).toFixed(1) + "T"
              : Math.abs(v) >= 1e3
                ? (v / 1e3).toFixed(0) + "B"
                : v.toFixed(1)
          }
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: T.textDim, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={55}
          tickFormatter={(v) =>
            Math.abs(v) >= 1e6
              ? (v / 1e6).toFixed(1) + "T"
              : Math.abs(v) >= 1e3
                ? (v / 1e3).toFixed(0) + "B"
                : v.toFixed(1)
          }
        />
        <ReTooltip content={<ChartTooltipContent />} />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey={key1}
          stroke={color1}
          strokeWidth={2}
          dot={false}
          name={name1}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey={key2}
          stroke={color2}
          strokeWidth={2}
          dot={false}
          name={name2}
          strokeDasharray="6 3"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── RANGE PRESETS ─────────────────────────────────────────────────────────────
const PRESETS = [
  { label: "4W", weeks: 4 },
  { label: "13W", weeks: 13 },
  { label: "26W", weeks: 26 },
  { label: "1Y", weeks: 52 },
  { label: "2Y", weeks: 104 },
  { label: "ALL", weeks: null },
];

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function MacroLiquidityDashboard() {
  const [loaded, setLoaded] = useState(false);
  const [activePreset, setActivePreset] = useState("1Y");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const datePickerRef = useRef(null);

  useEffect(() => {
    setTimeout(() => setLoaded(true), 100);
  }, []);

  // Close date picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target))
        setShowDatePicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Filter data by range
  const visibleData = useMemo(() => {
    if (customFrom || customTo) {
      return fullData.filter((d) => {
        if (customFrom && d.date < customFrom) return false;
        if (customTo && d.date > customTo) return false;
        return true;
      });
    }
    const preset = PRESETS.find((p) => p.label === activePreset);
    if (!preset || !preset.weeks) return fullData;
    return fullData.slice(-preset.weeks);
  }, [activePreset, customFrom, customTo, refreshCount]);

  const latest = visibleData[visibleData.length - 1];
  const prev4 =
    visibleData.length >= 5
      ? visibleData[visibleData.length - 5]
      : visibleData[0];

  const regime = useMemo(
    () => classifyRegime(latest, visibleData),
    [visibleData],
  );
  const changes4w = useMemo(() => whatChanged(latest, prev4), [visibleData]);

  const handlePreset = (label) => {
    setActivePreset(label);
    setCustomFrom("");
    setCustomTo("");
    setShowDatePicker(false);
  };

  const handleCustomApply = () => {
    if (customFrom || customTo) {
      setActivePreset("");
      setShowDatePicker(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshCount((c) => c + 1);
    setTimeout(() => setRefreshing(false), 800);
  };

  const kpis = latest
    ? [
        {
          label: "Net Liquidity",
          value: fmtB(latest.netLiq),
          change: fmtPct(latest.netLiq13w),
          tooltip: tooltips["Net Liquidity"],
        },
        {
          label: "13w ΔNet Liq",
          value: fmtPct(latest.netLiq13w),
          change: null,
          tooltip: tooltips["13w ΔNet Liq"],
        },
        {
          label: "M2",
          value: fmtB(latest.m2),
          change: fmtPct(latest.m2_13w),
          tooltip: tooltips["M2"],
        },
        {
          label: "13w ΔM2",
          value: fmtPct(latest.m2_13w),
          change: null,
          tooltip: tooltips["13w ΔM2"],
        },
        {
          label: "TGA",
          value: fmtM(latest.tga),
          change: fmtPct(
            prev4 ? ((latest.tga - prev4.tga) / prev4.tga) * 100 : null,
          ),
          tooltip: tooltips["TGA"],
        },
        {
          label: "RRP",
          value: fmtM(latest.rrp),
          change: fmtPct(
            prev4 ? ((latest.rrp - prev4.rrp) / prev4.rrp) * 100 : null,
          ),
          tooltip: tooltips["RRP"],
        },
        {
          label: "Fed Funds",
          value: fmtR(latest.fedfunds),
          change: fmtPct(
            prev4
              ? ((latest.fedfunds - prev4.fedfunds) / prev4.fedfunds) * 100
              : null,
          ),
          tooltip: tooltips["Fed Funds"],
          invertColor: true,
        },
        {
          label: "2Y Yield",
          value: fmtR(latest.dgs2),
          change: fmtPct(
            prev4 ? ((latest.dgs2 - prev4.dgs2) / prev4.dgs2) * 100 : null,
          ),
          tooltip: tooltips["2Y Yield"],
          invertColor: true,
        },
        {
          label: "DXY",
          value: fmtD(latest.dxy),
          change: fmtPct(latest.dxy4w),
          tooltip: tooltips["DXY"],
          invertColor: true,
        },
        {
          label: "WTI",
          value: fmtDol(latest.wti),
          change: fmtPct(latest.wti4w),
          tooltip: tooltips["WTI"],
          invertColor: true,
        },
        {
          label: "SPX",
          value: fmtP(latest.spx),
          change: fmtPct(latest.spx4w),
          tooltip: tooltips["SPX"],
        },
      ]
    : [];

  const fadeIn = (delay) => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? "translateY(0)" : "translateY(12px)",
    transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
  });

  const rangeLabel =
    customFrom || customTo
      ? `${customFrom || "start"} → ${customTo || "latest"}`
      : `Showing: ${activePreset === "ALL" ? "Full history" : "Last " + activePreset}`;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(170deg, ${T.bgHero} 0%, ${T.bgElevated} 30%, ${T.bgSurface} 100%)`,
        color: T.text,
        fontFamily: "'Exo 2', 'Play', system-ui, sans-serif",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;500;600;700&family=Play:wght@400;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7) sepia(1) hue-rotate(120deg); cursor: pointer; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <div
        style={{
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${T.divider}`,
          backdropFilter: "blur(20px)",
          background: "rgba(11, 12, 16, 0.8)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${T.primary}, ${T.primaryDark})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 16,
              color: "#003330",
              fontFamily: "'Play'",
            }}
          >
            S
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Play'",
                fontSize: 18,
                fontWeight: 700,
                color: T.text,
                letterSpacing: 0.5,
              }}
            >
              SSH Tech
            </div>
            <div
              style={{
                fontSize: 10,
                color: T.textDim,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                fontFamily: "'Exo 2'",
              }}
            >
              Macro Liquidity Dashboard
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 12,
            color: T.textDim,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {latest?.date ? `As of ${latest.date}` : ""} &nbsp;·&nbsp; Weekly
          &nbsp;·&nbsp; {visibleData.length} observations
        </div>
      </div>

      {/* ═══ TOOLBAR ═══ */}
      <div
        style={{
          padding: "12px 32px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          borderBottom: `1px solid ${T.borderSubtle}`,
          background: "rgba(14, 26, 36, 0.5)",
        }}
      >
        {/* Preset buttons */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: T.overlay5,
            borderRadius: 8,
            padding: 3,
          }}
        >
          {PRESETS.map((p) => {
            const isActive =
              activePreset === p.label && !customFrom && !customTo;
            return (
              <button
                key={p.label}
                onClick={() => handlePreset(p.label)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: 0.5,
                  transition: "all 0.15s",
                  background: isActive ? T.primary : "transparent",
                  color: isActive ? "#003330" : T.textDim,
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 28, background: T.borderMed }} />

        {/* Date picker toggle */}
        <div ref={datePickerRef} style={{ position: "relative" }}>
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${T.borderMed}`,
              background:
                customFrom || customTo
                  ? "rgba(7, 223, 193, 0.12)"
                  : "transparent",
              color: customFrom || customTo ? T.primary : T.textDim,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "'Exo 2'",
              fontWeight: 500,
              transition: "all 0.15s",
            }}
          >
            <Calendar size={14} />
            Custom Range
            <ChevronDown
              size={12}
              style={{
                transform: showDatePicker ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            />
          </button>

          {showDatePicker && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                zIndex: 200,
                background: T.bgHero,
                border: `1px solid ${T.borderMed}`,
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
                minWidth: 320,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: T.textDim,
                  marginBottom: 12,
                  fontFamily: "'Exo 2'",
                }}
              >
                Select Date Range
              </div>
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: 10,
                      color: T.textDim,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      display: "block",
                      marginBottom: 4,
                      fontFamily: "'Exo 2'",
                    }}
                  >
                    From
                  </label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    min={fullData[0]?.date}
                    max={fullData[fullData.length - 1]?.date}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      boxSizing: "border-box",
                      border: `1px solid ${T.borderMed}`,
                      background: T.bgElevated,
                      color: T.text,
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                      outline: "none",
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: 10,
                      color: T.textDim,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      display: "block",
                      marginBottom: 4,
                      fontFamily: "'Exo 2'",
                    }}
                  >
                    To
                  </label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    min={fullData[0]?.date}
                    max={fullData[fullData.length - 1]?.date}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      boxSizing: "border-box",
                      border: `1px solid ${T.borderMed}`,
                      background: T.bgElevated,
                      color: T.text,
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleCustomApply}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 6,
                    border: "none",
                    background: T.primary,
                    color: "#003330",
                    fontWeight: 700,
                    fontSize: 12,
                    fontFamily: "'Exo 2'",
                    cursor: "pointer",
                  }}
                >
                  Apply Range
                </button>
                <button
                  onClick={() => {
                    setCustomFrom("");
                    setCustomTo("");
                    setActivePreset("1Y");
                    setShowDatePicker(false);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 6,
                    border: `1px solid ${T.borderMed}`,
                    background: "transparent",
                    color: T.textDim,
                    fontWeight: 600,
                    fontSize: 12,
                    fontFamily: "'Exo 2'",
                    cursor: "pointer",
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Range info */}
        <div
          style={{
            fontSize: 11,
            color: T.textDim,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {rangeLabel}
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 28, background: T.borderMed }} />

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            borderRadius: 8,
            border: `1px solid ${T.borderMed}`,
            background: refreshing ? "rgba(7, 223, 193, 0.12)" : "transparent",
            color: refreshing ? T.primary : T.textDim,
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "'Exo 2'",
            fontWeight: 600,
            transition: "all 0.2s",
          }}
        >
          <RefreshCw
            size={14}
            style={{
              animation: refreshing ? "spin 0.8s linear infinite" : "none",
            }}
          />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div
        style={{ maxWidth: 1600, margin: "0 auto", padding: "24px 24px 60px" }}
      >
        {/* KPI CARDS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 12,
            marginBottom: 24,
            ...fadeIn(100),
          }}
        >
          {kpis.map((k, i) => (
            <KPICard key={i} {...k} />
          ))}
        </div>

        {/* CHART GRID */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))",
            gap: 16,
            marginBottom: 24,
            ...fadeIn(250),
          }}
        >
          <ChartPanel
            title="Net Liquidity (WALCL − TGA − RRP)"
            dotColor={T.primary}
          >
            <AreaChartPanel
              data={visibleData}
              dataKey="netLiq"
              color={T.primary}
            />
          </ChartPanel>
          <ChartPanel title="M2 Money Supply" dotColor={T.accent}>
            <AreaChartPanel data={visibleData} dataKey="m2" color={T.accent} />
          </ChartPanel>
          <ChartPanel title="TGA & RRP" dotColor={T.warning}>
            <DualLinePanel
              data={visibleData}
              key1="tga"
              key2="rrp"
              color1={T.warning}
              color2={T.errorLight}
              name1="TGA"
              name2="RRP"
            />
          </ChartPanel>
          <ChartPanel title="SPX vs Liquidity / SPX Ratio" dotColor="#52F6D7">
            <DualLinePanel
              data={visibleData}
              key1="spx"
              key2="liqVsSpx"
              color1="#52F6D7"
              color2={T.primaryDark}
              name1="SPX"
              name2="Liq/SPX"
            />
          </ChartPanel>
          <ChartPanel
            title="Oil (WTI) & Dollar (DXY)"
            dotColor={T.warningLight}
          >
            <DualLinePanel
              data={visibleData}
              key1="wti"
              key2="dxy"
              color1={T.warningLight}
              color2={T.error}
              name1="WTI"
              name2="DXY"
            />
          </ChartPanel>
          <ChartPanel title="Fed Funds & 2Y Yield" dotColor={T.primaryLight}>
            <DualLinePanel
              data={visibleData}
              key1="fedfunds"
              key2="dgs2"
              color1={T.primaryLight}
              color2={T.textSoft}
              name1="Fed Funds"
              name2="2Y Yield"
            />
          </ChartPanel>
        </div>

        {/* BOTTOM PANELS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
            ...fadeIn(400),
          }}
        >
          {/* REGIME */}
          <div
            style={{
              background: T.glassDark,
              border: `1px solid ${T.borderLight}`,
              borderRadius: 12,
              padding: "20px 20px 12px",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                color: T.textSoft,
                marginBottom: 16,
                fontFamily: "'Exo 2'",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: T.primary,
                  display: "inline-block",
                  boxShadow: `0 0 6px ${T.primary}60`,
                }}
              />
              Current Regime
            </div>
            {[
              { label: "Liquidity Backdrop", val: regime.liquidity },
              { label: "Inflation Pressure", val: regime.inflation },
              { label: "Risk Conditions", val: regime.risk },
            ].map((r, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <span
                  style={{
                    fontSize: 11,
                    color: T.textDim,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    fontFamily: "'Exo 2'",
                  }}
                >
                  {r.label}
                </span>
                <div style={{ marginTop: 4 }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "4px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      color: T.bgHero,
                      background: regimeColors[r.val],
                      marginRight: 8,
                    }}
                  >
                    {r.val}
                  </span>
                </div>
              </div>
            ))}
            <div
              style={{
                fontSize: 11,
                color: T.textDim,
                fontStyle: "italic",
                borderTop: `1px solid ${T.borderSubtle}`,
                paddingTop: 10,
                fontFamily: "'Exo 2'",
              }}
            >
              Rules-based classification. Not investment advice.
            </div>
          </div>

          {/* 4-WEEK CHANGES */}
          <div
            style={{
              background: T.glassDark,
              border: `1px solid ${T.borderLight}`,
              borderRadius: 12,
              padding: "20px 20px 12px",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                color: T.textSoft,
                marginBottom: 16,
                fontFamily: "'Exo 2'",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: T.accent,
                  display: "inline-block",
                  boxShadow: `0 0 6px ${T.accent}60`,
                }}
              />
              What Changed — Last 4 Weeks
            </div>
            {changes4w.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: 12,
                  padding: "7px 0",
                  borderBottom: `1px solid ${T.borderSubtle}`,
                  fontSize: 13,
                  alignItems: "center",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                <span style={{ color: T.textMuted, fontFamily: "'Exo 2'" }}>
                  {c.name}
                </span>
                <span style={{ color: T.text, fontWeight: 600 }}>
                  {c.current}
                </span>
                <span
                  style={{
                    color: c.positive ? T.primary : T.error,
                    fontWeight: 600,
                    textAlign: "right",
                  }}
                >
                  {c.pct}
                </span>
              </div>
            ))}
          </div>

          {/* RISK NOTES */}
          <div
            style={{
              background: T.glassDark,
              border: `1px solid ${T.borderLight}`,
              borderRadius: 12,
              padding: "20px 20px 12px",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                color: T.textSoft,
                marginBottom: 16,
                fontFamily: "'Exo 2'",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: T.warning,
                  display: "inline-block",
                  boxShadow: `0 0 6px ${T.warning}60`,
                }}
              />
              Risk Notes & Signals
            </div>
            {regime.notes.length === 0 ? (
              <div
                style={{ color: T.textDim, fontSize: 13, fontStyle: "italic" }}
              >
                No active signals.
              </div>
            ) : (
              regime.notes.map((note, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: T.textMuted,
                    padding: "6px 0",
                    borderBottom: `1px solid ${T.borderSubtle}`,
                    fontFamily: "'Exo 2'",
                  }}
                >
                  <span
                    style={{
                      color: note.startsWith("⚠")
                        ? T.warning
                        : note.startsWith("✓")
                          ? T.primary
                          : T.accent,
                      marginRight: 8,
                      fontWeight: 700,
                    }}
                  >
                    {note.charAt(0)}
                  </span>
                  {note.slice(2)}
                </div>
              ))
            )}
            <div
              style={{
                marginTop: 16,
                padding: "10px 14px",
                background: T.overlay5,
                borderRadius: 8,
                border: `1px solid ${T.borderSubtle}`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: T.textDim,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 6,
                  fontFamily: "'Exo 2'",
                }}
              >
                Thresholds
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: T.textMuted,
                  lineHeight: 1.8,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Liq expanding: NL 13w ROC &gt; 1% & M2 &gt; 0.5%
                <br />
                Inflation risk: WTI 4w &gt; 5% & DXY 4w &gt; 1%
                <br />
                Risk stressed: NL 13w &lt; -1% or SPX 13w &lt; -5%
                <br />
                RRP exhausted: &lt; $100B
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div
        style={{
          textAlign: "center",
          padding: "32px 0",
          borderTop: `1px solid ${T.divider}`,
          fontSize: 11,
          color: T.textDim,
          fontFamily: "'Exo 2'",
          letterSpacing: 0.5,
        }}
      >
        SSH Tech &nbsp;·&nbsp; Macro Liquidity Dashboard &nbsp;·&nbsp; Data:
        FRED API + Market Feeds &nbsp;·&nbsp; Not financial advice
      </div>
    </div>
  );
}
