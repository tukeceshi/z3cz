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
import { useOrgUrl } from "@/hooks/use-org-url";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import { useTelegramBot } from "@/services/bot-service";

import { BotTelegramEditDialog } from "./bot-telegram-edit-dialog";

export function BotTelegramDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { getOrgUrl } = useOrgUrl();

  const {
    telegramBot,
    telegramBotError,
    isTelegramBotLoading,
    mutateTelegramBot,
  } = useTelegramBot(id || null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.bots"), to: getOrgUrl("bots") },
      { label: telegramBot?.name || id || "" },
    ]);
  }, [id, telegramBot?.name, setBreadcrumbs, getOrgUrl, t]);

  if (isTelegramBotLoading) {
    return <InsetLoading title={t("pages.bots.detailTitle")} />;
  } else if (telegramBotError) {
    return (
      <InsetError
        title={t("pages.bots.detailTitle")}
        errorMessage={telegramBotError.message}
      />
    );
  } else if (!telegramBot) {
    return (
      <InsetError
        title={t("pages.bots.detailTitle")}
        errorMessage={t("pages.bots.notFound")}
      />
    );
  }

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
            value={telegramBot.name || t("pages.bots.untitled")}
          />
          <DetailRow
            label={t("pages.bots.botUsername")}
            value={
              telegramBot.botUsername ? `@${telegramBot.botUsername}` : "---"
            }
          />
          <DetailRow
            label={t("pages.bots.token")}
            value={`****${telegramBot.tokenLastFour}`}
            mono
          />
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">{t("pages.bots.links")}</h3>
          <div className="flex flex-col gap-2">
            {telegramBot.botUsername && (
              <a
                href={`https://t.me/${telegramBot.botUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t("pages.bots.openTelegramBot", {
                  username: telegramBot.botUsername,
                })}
              </a>
            )}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("pages.bots.openBotFather")}
            </a>
            <a
              href="https://core.telegram.org/bots/api"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("pages.bots.telegramApiDocs")}
            </a>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-medium">
            {t("pages.bots.setupInstructions")}
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>{t("pages.bots.telegramSetup1")}</li>
            <li>{t("pages.bots.telegramSetup2")}</li>
            <li>
              {t("pages.bots.telegramSetup3Before")}{" "}
              {telegramBot.botUsername ? (
                <a
                  href={`https://t.me/${telegramBot.botUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  @{telegramBot.botUsername}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                t("pages.bots.yourBot")
              )}{" "}
              {t("pages.bots.telegramSetup3After")}
            </li>
          </ol>
        </div>
      </div>
      <BotTelegramEditDialog
        bot={telegramBot}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onUpdated={() => mutateTelegramBot()}
      />
    </InsetLayout>
  );
}
