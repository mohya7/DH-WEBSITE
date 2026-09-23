import { theme, type ThemeConfig } from "antd";
import { action, accent, border, fonts, radii, semantic, surfaces, text } from "@digitalhub/theme/tokens.ts";

export const studioTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorBgBase: surfaces.page,
    colorBgContainer: surfaces.card,
    colorBgElevated: surfaces.raised,
    colorBgLayout: surfaces.page,
    colorText: text.primary,
    colorTextSecondary: text.secondary,
    colorTextTertiary: text.muted,
    colorTextQuaternary: text.muted,
    colorBorder: border.subtle,
    colorBorderSecondary: border.subtle,
    colorPrimary: action.primary,
    colorInfo: accent.studio,
    colorWarning: semantic.warning,
    colorError: semantic.error,
    colorLink: accent.studio,
    colorLinkHover: accent.studio,
    colorTextLightSolid: action.onPrimary,
    controlOutline: accent.studio,
    controlItemBgActive: surfaces.raised,
    controlItemBgHover: surfaces.raised,
    colorFillSecondary: surfaces.input,
    borderRadius: radii.control,
    borderRadiusLG: radii.raised,
    fontFamily: fonts.body,
    fontFamilyCode: fonts.body,
  },
  components: {
    Button: {
      colorPrimary: action.primary,
      colorPrimaryHover: "#2BACEF",
      colorPrimaryActive: "#1676BA",
      colorTextLightSolid: action.onPrimary,
      primaryShadow: "none",
      defaultShadow: "none",
      borderRadius: radii.control,
      controlHeight: 41,
    },
    Input: {
      colorBgContainer: surfaces.input,
      activeBorderColor: accent.studio,
      hoverBorderColor: accent.studio,
      activeShadow: "none",
    },
    Select: {
      colorBgContainer: surfaces.input,
      optionSelectedBg: surfaces.raised,
    },
    Table: {
      headerBg: surfaces.card,
      headerColor: text.secondary,
      rowHoverBg: surfaces.raised,
      borderColor: border.subtle,
    },
    Card: {
      colorBgContainer: surfaces.card,
      borderRadiusLG: radii.card,
    },
    Modal: {
      contentBg: surfaces.card,
      headerBg: surfaces.card,
      borderRadiusLG: radii.raised,
    },
    Drawer: {
      colorBgElevated: surfaces.card,
    },
    Segmented: {
      itemActiveBg: "rgba(31, 158, 233, 0.12)",
      itemSelectedBg: "rgba(31, 158, 233, 0.12)",
      itemSelectedColor: "#50B8EF",
      trackBg: "rgba(11, 24, 40, 0.82)",
    },
    Tag: {
      defaultBg: surfaces.raised,
      defaultColor: text.secondary,
    },
    Typography: {
      fontFamilyCode: fonts.body,
    },
  },
};
