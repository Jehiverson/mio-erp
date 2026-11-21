import { DEFAULTS } from "@/config";
import { LOCAL_STORAGE_KEYS, LocaleOption } from "@/constants";
import i18n from "@/i18n/i18n";

// Get client locale from local storage
export function getClientLocale(): LocaleOption {
  return (localStorage.getItem(LOCAL_STORAGE_KEYS.locale) as LocaleOption) || DEFAULTS.locale;
}

// Set client locale in local storage
export function setClientLocale(locale: LocaleOption) {
  i18n.changeLanguage(locale);
  localStorage.setItem(LOCAL_STORAGE_KEYS.locale, locale);
}
