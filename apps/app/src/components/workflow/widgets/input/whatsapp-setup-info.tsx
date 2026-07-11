import { useTranslation } from "@/components/locale-provider";

export function WhatsAppSetupInfo() {
  const { t } = useTranslation();
  const triggerLabel = t("pages.bots.wizard.triggers.receiveWhatsAppMessage");

  return (
    <div className="space-y-2 text-sm">
      <div className="space-y-1">
        <p className="font-medium text-foreground">
          {t("workflow.emailSetup.nextSteps")}
        </p>
        <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
          <li>
            {t("pages.bots.whatsappSetupInfoStep1", { trigger: triggerLabel })}
          </li>
          <li>{t("pages.bots.whatsappSetupInfoStep2")}</li>
          <li>{t("pages.bots.whatsappSetupInfoStep3")}</li>
        </ol>
      </div>
    </div>
  );
}
