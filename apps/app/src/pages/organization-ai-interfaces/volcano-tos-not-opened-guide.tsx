import { useTranslation } from "@/components/locale-provider";

export const VOLCANO_TOS_CONSOLE_URL = "https://console.volcengine.com/tos";

const linkClassName =
  "text-primary underline-offset-4 hover:underline font-medium";

interface VolcanoTosGuideProps {
  readonly compact?: boolean;
}

export function VolcanoTosNotOpenedGuide({ compact = false }: VolcanoTosGuideProps) {
  const { t } = useTranslation();

  return (
    <p
      className={
        compact
          ? "text-muted-foreground text-xs leading-relaxed"
          : "text-muted-foreground text-sm leading-relaxed"
      }
    >
      {t("pages.aiInterfaces.tosStorage.notOpened.prefix")}
      <a
        href={VOLCANO_TOS_CONSOLE_URL}
        target="_blank"
        rel="noreferrer"
        className={linkClassName}
      >
        {t("pages.aiInterfaces.tosStorage.notOpened.link")}
      </a>
      {t("pages.aiInterfaces.tosStorage.notOpened.suffix")}
    </p>
  );
}

export function VolcanoTosAuthErrorGuide({ compact = false }: VolcanoTosGuideProps) {
  const { t } = useTranslation();

  return (
    <p
      className={
        compact
          ? "text-destructive text-xs leading-relaxed"
          : "text-destructive text-sm leading-relaxed"
      }
    >
      {t("pages.aiInterfaces.tosStorage.authErrorHint")}
    </p>
  );
}
