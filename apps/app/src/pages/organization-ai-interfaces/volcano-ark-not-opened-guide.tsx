import { useTranslation } from "@/components/locale-provider";

export const VOLCANO_ARK_OPEN_MANAGEMENT_URL =
  "https://console.volcengine.com/ark/region:cn-beijing/openManagement";

const linkClassName =
  "text-primary underline-offset-4 hover:underline font-medium";

export function VolcanoArkNotOpenedGuide() {
  const { t } = useTranslation();

  return (
    <p className="text-muted-foreground text-sm leading-relaxed">
      {t("pages.aiInterfaces.volcano.activation.arkNotOpened.prefix")}
      <a
        href={VOLCANO_ARK_OPEN_MANAGEMENT_URL}
        target="_blank"
        rel="noreferrer"
        className={linkClassName}
      >
        {t("pages.aiInterfaces.volcano.activation.arkNotOpened.link")}
      </a>
      {t("pages.aiInterfaces.volcano.activation.arkNotOpened.suffix")}
    </p>
  );
}
