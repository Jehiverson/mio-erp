import { ModeVariant, ThemeVariant } from "@/constants";
import { ContentType, Elevation, MenuType, TopNavType } from "@/types/types";

export const DEFAULTS = {
  locale: "en",
  themeColor: "theme-purple" as ThemeVariant,
  themeMode: "system" as ModeVariant,
  elevation: Elevation.Flat,
  contentType: ContentType.Boxed,
  topNavType: TopNavType.Contained,
  leftMenuType: MenuType.Comfort,
  leftMenuWidth: {
    [MenuType.Minimal]: { primary: 60, secondary: 260 },
    [MenuType.Comfort]: { primary: 116, secondary: 260 },
    [MenuType.SingleLayer]: { primary: 280, secondary: 0 },
  },
  transitionDuration: 150,
  menuPrimaryBreakpoint: "md",
  menuSecondaryBreakpoint: "xl",
};
