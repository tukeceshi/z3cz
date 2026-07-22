import type { AppLocale, PublicSiteSettings } from "@dafthunk/types";
import { DEFAULT_PLATFORM_FEATURE_CONFIG } from "@dafthunk/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import useSWR from "swr";

import {
  createTranslator,
  detectBrowserLocale,
  loadLocaleDictionary,
  LOCALE_STORAGE_KEY,
  readStoredLocale,
  resolveInitialLocale,
  type TranslateFn,
  type TranslationDictionary,
  type TranslationKey,
} from "@/i18n";
import { RoutePageFallback } from "@/components/route-page-fallback";
import { makeRequest } from "@/services/utils";

const bootLocale = resolveInitialLocale(
  readStoredLocale() ?? detectBrowserLocale()
);
void loadLocaleDictionary(bootLocale);

interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: TranslateFn;
  siteSettings: PublicSiteSettings;
  refreshSiteSettings: () => Promise<void>;
}

const DEFAULT_SITE_SETTINGS: PublicSiteSettings = {
  siteName: "Dafthunk",
  siteTagline: "Build serverless workflows visually.",
  defaultLocale: "zh",
  supportEmail: null,
  featureConfig: DEFAULT_PLATFORM_FEATURE_CONFIG,
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

async function fetchPublicSiteSettings(): Promise<PublicSiteSettings> {
  return makeRequest<PublicSiteSettings>("/site-settings", {}, true);
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { data, mutate } = useSWR("/site-settings", fetchPublicSiteSettings, {
    revalidateOnFocus: true,
    shouldRetryOnError: true,
  });

  const siteSettings = data ?? DEFAULT_SITE_SETTINGS;

  const [locale, setLocaleState] = useState<AppLocale>(() =>
    resolveInitialLocale(readStoredLocale() ?? detectBrowserLocale())
  );
  const [dictionary, setDictionary] = useState<TranslationDictionary | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    void loadLocaleDictionary(locale).then((loaded) => {
      if (!cancelled) {
        setDictionary(loaded);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    if (data?.defaultLocale && !readStoredLocale()) {
      setLocaleState(data.defaultLocale);
    }
  }, [data]);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    setLocaleState(nextLocale);
  }, []);

  const t = useMemo<TranslateFn>(() => {
    if (!dictionary) {
      return (key: TranslationKey) => key;
    }
    return createTranslator(locale, dictionary);
  }, [dictionary, locale]);

  const refreshSiteSettings = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      siteSettings,
      refreshSiteSettings,
    }),
    [locale, setLocale, t, siteSettings, refreshSiteSettings]
  );

  if (!dictionary) {
    return <RoutePageFallback variant="full" />;
  }

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}

export function useTranslation() {
  const { locale, setLocale, t, siteSettings, refreshSiteSettings } =
    useLocale();
  return { locale, setLocale, t, siteSettings, refreshSiteSettings };
}
