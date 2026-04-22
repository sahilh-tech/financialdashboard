import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#040A19",
        panel: "#081D2E",
        panelBorder: "rgba(111, 151, 179, 0.22)",
        uiSurfaceGlass: "rgba(8, 30, 48, 0.86)",
        uiSurfaceGlassDeep: "rgba(6, 17, 31, 0.94)",
        uiBar: "rgba(5, 18, 31, 0.95)",
        uiBorderMedium: "rgba(255, 255, 255, 0.12)",
        uiTextPrimary: "#EFFEEB",
        uiTextSecondary: "#91FEE6",
        uiTextDim: "#8EA0B8",
        uiHover: "rgba(7, 223, 193, 0.08)",
        primary: "#07DFC1",
        primaryDark: "#029F8C",
        primaryText: "#003330",
        warning: "#F0A04B",
        warningLight: "#F5BC7A",
        supportive: "#28c76f",
        neutral: "#f0ad4e",
        adverse: "#ff4d4f",
        textMuted: "#dde3e9"
      }
    }
  },
  darkMode: "class",
  plugins: []
};

export default config;
