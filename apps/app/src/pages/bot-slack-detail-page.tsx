import Copy from "lucide-react/icons/copy";
import ExternalLink from "lucide-react/icons/external-link";
import Pencil from "lucide-react/icons/pencil";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import { getApiBaseUrl } from "@/config/api";
import { useAppToast } from "@/hooks/use-app-toast";
import { useOrgUrl } from "@/hooks/use-org-url";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import { useSlackBot } from "@/services/bot-service";

import { BotSlackEditDialog } from "./bot-slack-edit-dialog";

export function BotSlackDetailPage() {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const { id } = useParams<{ id: string }>();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { getOrgUrl } = useOrgUrl();

  const { slackBot, slackBotError, isSlackBotLoading, mutateSlackBot } =
    useSlackBot(id || null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.bots"), to: getOrgUrl("bots") },
      { label: slackBot?.name || id || "" },
    ]);
  }, [id, slackBot?.name, setBreadcrumbs, getOrgUrl, t]);

  if (isSlackBotLoading) {
    return <InsetLoading title={t("pages.bots.detailTitle")} />;
  } else if (slackBotError) {
    return (
      <InsetError
        title={t("pages.bots.detailTitle")}
        errorMessage={slackBotError.message}
      />
    );
  } else if (!slackBot) {
    return (
      <InsetError
        title={t("pages.bots.detailTitle")}
        errorMessage={t("pages.bots.notFound")}
      />
    );
  }

  const webhookUrl = `${getApiBaseUrl()}/slack/webhook/${slackBot.id}`;

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
            value={slackBot.name || t("pages.bots.untitled")}
          />
          {slackBot.teamName && (
            <DetailRow label={t("pages.bots.workspace")} value={slackBot.teamName} />
          )}
          {slackBot.appId && (
            <DetailRow
              label={t("pages.bots.appId")}
              value={slackBot.appId}
              mono
            />
          )}
          <DetailRow
            label={t("pages.bots.token")}
            value={`****${slackBot.tokenLastFour}`}
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
              href="https://api.slack.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("pages.bots.openSlackApiPortal")}
            </a>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-medium">
            {t("pages.bots.setupInstructions")}
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>{t("pages.bots.slackSetup1")}</li>
            <li>{t("pages.bots.slackSetup2")}</li>
            <li>{t("pages.bots.slackSetup3", { name: slackBot.name })}</li>
            <li>{t("pages.bots.slackSetup4")}</li>
          </ol>
        </div>
      </div>
      <BotSlackEditDialog
        bot={slackBot}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onUpdated={() => mutateSlackBot()}
      />
    </InsetLayout>
  );
}
