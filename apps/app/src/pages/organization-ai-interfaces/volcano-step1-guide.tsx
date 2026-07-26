import { useTranslation } from "@/components/locale-provider";

const VOLCANO_OFFICIAL_URL = "https://www.volcengine.com";
const IAM_KEY_URL = "https://console.volcengine.com/iam/keymanage";

const linkClassName =
  "text-primary underline-offset-4 hover:underline font-medium";

export function VolcanoStep1Guide() {
  const { t } = useTranslation();

  return (
    <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm leading-relaxed">
      <li>
        {t("pages.aiInterfaces.volcano.step1Guide.signInPrefix")}
        <a
          href={VOLCANO_OFFICIAL_URL}
          target="_blank"
          rel="noreferrer"
          className={linkClassName}
        >
          {t("pages.aiInterfaces.volcano.step1Guide.officialSite")}
        </a>
        {t("pages.aiInterfaces.volcano.step1Guide.signInSuffix")}
      </li>
      <li>
        {t("pages.aiInterfaces.volcano.step1Guide.createKeyPrefix")}
        <a
          href={IAM_KEY_URL}
          target="_blank"
          rel="noreferrer"
          className={linkClassName}
        >
          {t("pages.aiInterfaces.volcano.step1Guide.iamQuickLink")}
        </a>
        {t("pages.aiInterfaces.volcano.step1Guide.createKeySuffix")}
      </li>
      <li>{t("pages.aiInterfaces.volcano.step1Guide.pasteKeys")}</li>
    </ol>
  );
}

export { IAM_KEY_URL };
