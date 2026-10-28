import { create } from "zustand";
import { localeFromPath } from "@/seo/browser";
import { translate, type Locale, type TranslationParams } from "./index";

export const useLanguage = create<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>((set) => ({
  locale: localeFromPath(
    typeof window === "undefined" ? "/" : window.location.pathname,
  ),
  setLocale: (locale) => set({ locale }),
}));
/** Language comes from the public page path; credentials and payloads remain in memory. */
export function useI18n() {
  const locale = useLanguage((state) => state.locale);
  const setLocale = useLanguage((state) => state.setLocale);
  return {
    locale,
    setLocale,
    t: (message: string, params?: TranslationParams) =>
      translate(message, locale, params),
  };
}
