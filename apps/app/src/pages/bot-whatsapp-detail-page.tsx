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
import { useAppToast } from "@/hooks/use-app-toast";
import { useOrgUrl } from "@/hooks/use-org-url";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import {
  useWhatsAppAccount,
  useWhatsAppWebhookInfo,
} from "@/services/bot-service";

import { BotWhatsAppEditDialog } from "./bot-whatsapp-edit-dialog";

export function BotWhatsAppDetailPage() {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const { id } = useParams<{ id: string }>();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { getOrgUrl } = useOrgUrl();

  const {
    whatsappAccount,
    whatsappAccountError,
    isWhatsAppAccountLoading,
    mutateWhatsAppAccount,
  } = useWhatsAppAccount(id || null);
  const { webhookInfo } = useWhatsAppWebhookInfo(id || null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const copyToClipboard = (
    text: string,
    labelKey: "pages.bots.callbackUrl" | "pages.bots.verifyToken"
  ) => {
    navigator.clipboard.writeText(text);
    appToast.success("pages.bots.copiedToast", { label: t(labelKey) });
  };

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.bots"), to: getOrgUrl("bots") },
      { label: whatsappAccount?.name || id || "" },
    ]);
  }, [id, whatsappAccount?.name, setBreadcrumbs, getOrgUrl, t]);

  if (isWhatsAppAccountLoading) {
    return <InsetLoading title={t("pages.bots.accountTitle")} />;
  } else if (whatsappAccountError) {
    return (
      <InsetError
        title={t("pages.bots.accountTitle")}
        errorMessage={whatsappAccountError.message}
      />
    );
  } else if (!whatsappAccount) {
    return (
      <InsetError
        title={t("pages.bots.accountTitle")}
        errorMessage={t("pages.bots.accountNotFound")}
      />
    );
  }

  return (
    <InsetLayout title={t("pages.bots.accountTitle")}>
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
            value={whatsappAccount.name || t("pages.bots.untitledAccount")}
          />
          <DetailRow
            label={t("pages.bots.phoneNumberId")}
            value={whatsappAccount.phoneNumberId}
            mono
          />
          <DetailRow
            label={t("pages.bots.wabaId")}
            value={whatsappAccount.wabaId || "---"}
            mono
          />
          <DetailRow
            label={t("pages.bots.accessToken")}
            value={`****${whatsappAccount.tokenLastFour}`}
            mono
          />
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-medium">{t("pages.bots.webhookConfig")}</h3>
          {webhookInfo?.verifyToken ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {t("pages.bots.webhookMetaHint")}
              </p>
              <div className="grid grid-cols-[120px_1fr] gap-2 items-start">
                <span className="text-sm font-medium text-muted-foreground">
                  {t("pages.bots.callbackUrl")}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono break-all">
                    {webhookInfo.webhookUrl}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() =>
                      copyToClipboard(
                        webhookInfo.webhookUrl!,
                        "pages.bots.callbackUrl"
                      )
                    }
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  {t("pages.bots.verifyToken")}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono break-all">
                    {webhookInfo.verifyToken}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() =>
                      copyToClipboard(
                        webhookInfo.verifyToken!,
                        "pages.bots.verifyToken"
                      )
                    }
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("pages.bots.webhookGenerateHint")}
            </p>
          )}
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-medium">
            {t("pages.bots.setupInstructions")}
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>
              {t("pages.bots.whatsappSetup1Before")}{" "}
              <a
                href="https://developers.facebook.com/apps/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                {t("pages.bots.metaDeveloperPortal")}
                <ExternalLink className="h-3 w-3" />
              </a>{" "}
              {t("pages.bots.whatsappSetup1After")}
            </li>
            <li>{t("pages.bots.whatsappSetup2")}</li>
            <li>{t("pages.bots.whatsappSetup3")}</li>
          </ol>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">{t("pages.bots.links")}</h3>
          <div className="flex flex-col gap-2">
            <a
              href="https://developers.facebook.com/apps/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("pages.bots.openMetaDevPortal")}
            </a>
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("pages.bots.whatsappCloudApiDocs")}
            </a>
          </div>
        </div>
      </div>
      <BotWhatsAppEditDialog
        account={whatsappAccount}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onUpdated={() => mutateWhatsAppAccount()}
      />
    </InsetLayout>
  );
}
