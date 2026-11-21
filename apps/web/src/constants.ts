export const LOCALES = ["de", "en", "fr", "es", "ar"] as const;
export type LocaleOption = (typeof LOCALES)[number];

export const THEME_OPTIONS = {
  PURPLE: "theme-purple",
  BLUE: "theme-blue",
  GREEN: "theme-green",
  ORANGE: "theme-orange",
} as const;

export type ThemeVariant = (typeof THEME_OPTIONS)[keyof typeof THEME_OPTIONS];

export type ModeVariant = (typeof THEME_MODE_OPTIONS)[number];
export const THEME_MODE_OPTIONS = ["light", "dark", "system"] as const;

const storagePrefix = import.meta.env.VITE_STORAGE_PREFIX || "";

export const LOCAL_STORAGE_KEYS = {
  locale: `${storagePrefix}-locale`,
  themeColor: `${storagePrefix}-theme-color`,
  themeMode: `${storagePrefix}-theme-mode`,
  leftMenuType: `${storagePrefix}-left-menu-type`,
  contentType: `${storagePrefix}-content-type`,
  topNavType: `${storagePrefix}-top-nav-type`,
  elevation: `${storagePrefix}-elevation`,
};

export const LINKS = {
  figma:
    "https://www.figma.com/design/02z6A32cjoLLnB6c4SyC4S/prod-gogo-design-9.0.0?node-id=11550-74808&t=StxvVcheUPOSTywA-4",
  purchase: "https://themeforest.net/cart/configure_before_adding/22544383?license=regular",
  purchase_extended: "https://themeforest.net/cart/configure_before_adding/22544383?license=extended",
  docs: "/docs/welcome/introduction",
  view: "/auth/sign-in",
  signup: "/auth/sign-up",
  login: "/auth/sign-in",
  components: "/ui",
  home: "/home/sub",
} as const;
