import { useTranslation } from "@/components/locale-provider";

import { CopyableValue } from "./copyable-value";

interface EmailSetupInfoProps {
  emailAddress: string;
}

export function EmailSetupInfo({ emailAddress }: EmailSetupInfoProps) {
  const { t } = useTranslation();
  const triggerLabel = t("workflow.emailSetup.receiveEmailTrigger");

  return (
    <div className="space-y-2 text-sm">
      <div className="space-y-1">
        <p className="font-medium text-foreground">
          {t("workflow.emailSetup.addressLabel")}
        </p>
        <CopyableValue value={emailAddress} />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">
          {t("workflow.emailSetup.nextSteps")}
        </p>
        <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
          <li>
            {t("workflow.emailSetup.step1", { trigger: triggerLabel })}
          </li>
          <li>{t("workflow.emailSetup.step2")}</li>
          <li>{t("workflow.emailSetup.step3")}</li>
        </ol>
      </div>
    </div>
  );
}
