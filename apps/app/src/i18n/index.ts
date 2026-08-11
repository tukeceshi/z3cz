import type { AppLocale } from "@dafthunk/types";

import type { TranslationDictionary } from "./locales/en";

export const LOCALE_STORAGE_KEY = "dafthunk-locale";

export type { TranslationDictionary };

const localeLoaders: Record<
  AppLocale,
  () => Promise<TranslationDictionary>
> = {
  en: async () => {
    const module = await import("./locales/en");
    return module.en;
  },
  zh: async () => {
    const module = await import("./locales/zh");
    return module.zh;
  },
};

const localeCache = new Map<AppLocale, TranslationDictionary>();

export function getCachedLocaleDictionary(
  locale: AppLocale
): TranslationDictionary | null {
  return localeCache.get(locale) ?? null;
}

export async function loadLocaleDictionary(
  locale: AppLocale
): Promise<TranslationDictionary> {
  const cached = localeCache.get(locale);
  if (cached) {
    return cached;
  }

  const dictionary = await localeLoaders[locale]();
  localeCache.set(locale, dictionary);
  return dictionary;
}

type NestedKeyOf<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string
        ? K
        : `${K}.${NestedKeyOf<T[K]>}`;
    }[keyof T & string];

export type TranslationKey = NestedKeyOf<TranslationDictionary>;

function getNestedValue(
  dictionary: TranslationDictionary,
  key: string
): string | undefined {
  const parts = key.split(".");
  let current: unknown = dictionary;

  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : undefined;
}

export function createTranslator(
  locale: AppLocale,
  dictionary: TranslationDictionary,
  fallbackDictionary?: TranslationDictionary
) {
  return (
    key: TranslationKey,
    params?: Record<string, string | number>
  ): string => {
    let value = getNestedValue(dictionary, key);
    if (value === undefined && fallbackDictionary) {
      value = getNestedValue(fallbackDictionary, key);
    }
    if (value === undefined && locale !== "en") {
      value = getNestedValue(
        localeCache.get("en") ?? dictionary,
        key
      );
    }
    if (value === undefined) {
      return key;
    }

    if (!params) {
      return value;
    }

    return Object.entries(params).reduce(
      (result, [paramKey, paramValue]) =>
        result.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, "g"), String(paramValue)),
      value
    );
  };
}

export type TranslateFn = ReturnType<typeof createTranslator>;

export function readStoredLocale(): AppLocale | null {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === "en" || stored === "zh") {
    return stored;
  }
  return null;
}

export function detectBrowserLocale(): AppLocale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language.toLowerCase();
  return lang.startsWith("zh") ? "zh" : "en";
}

export function resolveInitialLocale(defaultLocale: AppLocale): AppLocale {
  return readStoredLocale() ?? defaultLocale;
}
