import { ExternalLink } from "lucide-react";

import { useTranslation } from "@/components/locale-provider";

interface TelegramBotSetupInfoProps {
  botUsername: string | null;
}

export function TelegramBotSetupInfo({
  botUsername,
}: TelegramBotSetupInfoProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2 text-sm">
      <div className="space-y-1">
        <p className="font-medium text-foreground">
          {t("workflow.emailSetup.nextSteps")}
        </p>
        <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
          <li>{t("pages.bots.telegramSetup1")}</li>
          <li>{t("pages.bots.telegramSetup2")}</li>
          <li>
            {t("pages.bots.telegramSetup3Before")}{" "}
            {botUsername ? (
              <a
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                @{botUsername}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ) : (
              t("pages.bots.yourBot")
            )}{" "}
            {t("pages.bots.telegramSetup3After")}
          </li>
        </ol>
      </div>
    </div>
  );
}
