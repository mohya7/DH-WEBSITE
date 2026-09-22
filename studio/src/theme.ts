import type { ThemeConfig } from "antd";

export const brand = {
  primary: "#1270A0",
  accent: "#F4970B",
  fontFamily: "Poppins, sans-serif",
} as const;

export const studioTheme: ThemeConfig = {
  token: {
    colorPrimary: brand.primary,
    fontFamily: brand.fontFamily,
  },
};
