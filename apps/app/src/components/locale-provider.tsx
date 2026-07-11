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
  LOCALE_STORAGE_KEY,
  readStoredLocale,
  resolveInitialLocale,
  type TranslateFn,
} from "@/i18n";
import { makeRequest } from "@/services/utils";

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

  const t = useMemo(() => createTranslator(locale), [locale]);

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
