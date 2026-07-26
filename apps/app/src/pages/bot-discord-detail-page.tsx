import Copy from "lucide-react/icons/copy";
import ExternalLink from "lucide-react/icons/external-link";
import Pencil from "lucide-react/icons/pencil";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useOwnerPageGuard } from "@/hooks/use-owner-page-guard";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import { getApiBaseUrl } from "@/config/api";
import { useAppToast } from "@/hooks/use-app-toast";
import { useOrgUrl } from "@/hooks/use-org-url";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import { useDiscordBot } from "@/services/bot-service";

import { BotDiscordEditDialog } from "./bot-discord-edit-dialog";

export function BotDiscordDetailPage() {
  const ownerGuard = useOwnerPageGuard("sidebar.bots");
  if (ownerGuard.blocked) return ownerGuard.gate;
  return <BotDiscordDetailPageContent />;
}

function BotDiscordDetailPageContent() {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const { id } = useParams<{ id: string }>();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { getOrgUrl } = useOrgUrl();

  const { discordBot, discordBotError, isDiscordBotLoading, mutateDiscordBot } =
    useDiscordBot(id || null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.bots"), to: getOrgUrl("bots") },
      { label: discordBot?.name || id || "" },
    ]);
  }, [id, discordBot?.name, setBreadcrumbs, getOrgUrl, t]);

  if (isDiscordBotLoading) {
    return <InsetLoading title={t("pages.bots.detailTitle")} />;
  } else if (discordBotError) {
    return (
      <InsetError
        title={t("pages.bots.detailTitle")}
        errorMessage={discordBotError.message}
      />
    );
  } else if (!discordBot) {
    return (
      <InsetError
        title={t("pages.bots.detailTitle")}
        errorMessage={t("pages.bots.notFound")}
      />
    );
  }

  const webhookUrl = `${getApiBaseUrl()}/discord/webhook/${discordBot.id}`;
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${discordBot.applicationId}&scope=bot+applications.commands&permissions=2048`;
  const devPortalUrl = `https://discord.com/developers/applications/${discordBot.applicationId}`;

  const copyToClipboard = (text: string, labelKey: "pages.bots.webhookUrl") => {
    navigator.clipboard.writeText(text);
    appToast.success("pages.bots.copiedToast", { label: t(labelKey) });
  };

  return (
    <InsetLayout title={t("pages.bots.detailTitle")}>
      <div className="space-y-8">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditOpen(true)}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {t("pages.bots.edit")}
          </Button>
        </div>
        <div className="space-y-4">
          <DetailRow
            label={t("common.name")}
            value={discordBot.name || t("pages.bots.untitled")}
          />
          <DetailRow
            label={t("pages.bots.applicationId")}
            value={discordBot.applicationId}
            mono
          />
          <DetailRow
            label={t("pages.bots.publicKey")}
            value={discordBot.publicKey}
            mono
          />
          <DetailRow
            label={t("pages.bots.token")}
            value={`****${discordBot.tokenLastFour}`}
            mono
          />
          <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
            <span className="text-sm font-medium text-muted-foreground">
              {t("pages.bots.webhookUrl")}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono break-all">{webhookUrl}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => copyToClipboard(webhookUrl, "pages.bots.webhookUrl")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">{t("pages.bots.links")}</h3>
          <div className="flex flex-col gap-2">
            <a
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("pages.bots.inviteDiscordBot")}
            </a>
            <a
              href={devPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("pages.bots.openDiscordDevPortal")}
            </a>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-medium">
            {t("pages.bots.setupInstructions")}
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>
              {t("pages.bots.discordSetup1Before")}{" "}
              <a
                href={`${devPortalUrl}/information`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                {t("pages.bots.generalInformation")}
                <ExternalLink className="h-3 w-3" />
              </a>{" "}
              {t("pages.bots.discordSetup1After")}
            </li>
            <li>
              <a
                href={inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                {t("pages.bots.inviteTheBot")}
                <ExternalLink className="h-3 w-3" />
              </a>{" "}
              {t("pages.bots.discordSetup2After")}
            </li>
            <li>{t("pages.bots.discordSetup3")}</li>
          </ol>
        </div>
      </div>
      <BotDiscordEditDialog
        bot={discordBot}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onUpdated={() => mutateDiscordBot()}
      />
    </InsetLayout>
  );
}
