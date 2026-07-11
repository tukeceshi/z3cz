import { ExternalLink } from "lucide-react";

import { useTranslation } from "@/components/locale-provider";
import { getApiBaseUrl } from "@/config/api";

import { CopyableValue } from "./copyable-value";

interface DiscordBotSetupInfoProps {
  botId: string;
  applicationId: string;
}

export function DiscordBotSetupInfo({
  botId,
  applicationId,
}: DiscordBotSetupInfoProps) {
  const { t } = useTranslation();
  const baseUrl = getApiBaseUrl().replace(/\/$/, "");
  const webhookUrl = `${baseUrl}/discord/webhook/${botId}`;
  const portalUrl = `https://discord.com/developers/applications/${applicationId}/information`;

  return (
    <div className="space-y-2 text-sm">
      <div className="space-y-1">
        <p className="font-medium text-foreground">
          {t("pages.bots.wizard.discord.interactionsEndpointUrl")}
        </p>
        <CopyableValue value={webhookUrl} />
        <p className="text-muted-foreground text-xs">
          {t("pages.bots.wizard.discord.interactionsHintBefore")}{" "}
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-0.5"
          >
            {t("pages.bots.discordDeveloperPortal")}
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
          {t("pages.bots.wizard.discord.interactionsHintAfter")}
        </p>
      </div>
    </div>
  );
}
