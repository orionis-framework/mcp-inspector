import { create } from "zustand";
import {
  DEFAULT_LOCALE,
  translate,
  type Locale,
  type TranslationParams,
} from "./index";

export const useLanguage = create<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>((set) => ({
  locale: DEFAULT_LOCALE,
  setLocale: (locale) => set({ locale }),
}));
/** Language is a tab preference; no credentials or payloads are persisted. */
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
