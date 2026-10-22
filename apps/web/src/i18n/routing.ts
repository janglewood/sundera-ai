import { defineRouting } from "next-intl/routing";

export const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
};

export const routing = defineRouting({
  locales: ["en", "es", "fr", "de", "pt"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
