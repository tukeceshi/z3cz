import { HeadSeo } from "@/components/head-seo";
import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";

interface RouteHeadProps {
  titleKey: TranslationKey;
  descriptionKey?: TranslationKey;
}

function RouteHead({ titleKey, descriptionKey }: RouteHeadProps) {
  const { t, siteSettings } = useTranslation();
  const params = { siteName: siteSettings.siteName };

  return (
    <HeadSeo
      title={t(titleKey, params)}
      description={descriptionKey ? t(descriptionKey, params) : undefined}
    />
  );
}

export function createRouteHead(
  titleKey: TranslationKey,
  descriptionKey?: TranslationKey
) {
  return () => (
    <RouteHead titleKey={titleKey} descriptionKey={descriptionKey} />
  );
}
