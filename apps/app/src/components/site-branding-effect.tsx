import { useEffect } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbs } from "@/components/page-context";

export function SiteBrandingEffect() {
  const { siteSettings } = useTranslation();
  const { breadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    const currentPage = breadcrumbs.at(-1)?.label;
    document.title = currentPage
      ? `${currentPage} - ${siteSettings.siteName}`
      : siteSettings.siteName;
  }, [breadcrumbs, siteSettings.siteName]);

  return null;
}
