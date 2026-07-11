import { ExternalLink } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { getApiBaseUrl } from "@/config/api";
import { createWhatsAppAccount } from "@/services/bot-service";

import { CopyableValue } from "./copyable-value";

type Step = "name" | "app-secret" | "api-credentials" | "webhook" | "setup";

const WHATSAPP_STEP_KEYS: Record<
  Step,
  "name" | "appSecret" | "apiCredentials" | "webhook" | "setup"
> = {
  name: "name",
  "app-secret": "appSecret",
  "api-credentials": "apiCredentials",
  webhook: "webhook",
  setup: "setup",
};

const META_PORTAL_URL = "https://developers.facebook.com/apps/";

interface WhatsAppAccountCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (accountId: string) => void;
}

export function WhatsAppAccountCreateDialog({
  isOpen,
  onClose,
  onCreated,
}: WhatsAppAccountCreateDialogProps) {
  const { organization } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);
  const [createdVerifyToken, setCreatedVerifyToken] = useState<string | null>(
    null
  );

  const stepKey = WHATSAPP_STEP_KEYS[step];

  const resetForm = () => {
    setStep("name");
    setName("");
    setAppSecret("");
    setAccessToken("");
    setPhoneNumberId("");
    setWabaId("");
    setError(null);
    setCreatedAccountId(null);
    setCreatedVerifyToken(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!organization?.id) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await createWhatsAppAccount(
        {
          name,
          accessToken,
          phoneNumberId,
          wabaId: wabaId || undefined,
          appSecret,
        },
        organization.id
      );
      setCreatedAccountId(response.id);
      setCreatedVerifyToken(
        (response.metadata as Record<string, string | undefined> | null)
          ?.verifyToken ?? null
      );
      setStep("webhook");
      onCreated(response.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("pages.bots.wizard.createAccountFailed")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const webhookUrl = createdAccountId
    ? `${getApiBaseUrl().replace(/\/$/, "")}/whatsapp/webhook/${createdAccountId}`
    : "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[450px]">
        <div>
          <DialogTitle className="text-base font-semibold">
            {t(`pages.bots.wizard.whatsapp.steps.${stepKey}.title`)}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            {t(`pages.bots.wizard.whatsapp.steps.${stepKey}.description`)}
            {(step === "app-secret" ||
              step === "api-credentials" ||
              step === "webhook") && (
              <>
                {" "}
                <a
                  href={META_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  {t("pages.bots.wizard.whatsapp.openMetaPortal")}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </>
            )}
          </DialogDescription>
        </div>

        {step === "name" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp-name">{t("common.name")}</Label>
              <Input
                id="whatsapp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("pages.bots.wizard.placeholders.whatsappAccount")}
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.bots.wizard.accountNameHint")}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => setStep("app-secret")}
                disabled={name.trim() === ""}
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        )}

        {step === "app-secret" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp-app-secret">
                {t("pages.bots.appSecret")}
              </Label>
              <Input
                id="whatsapp-app-secret"
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder={t("pages.bots.wizard.placeholders.appSecret")}
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.bots.wizard.whatsapp.appSecretFieldHint")}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("name")}
              >
                {t("common.back")}
              </Button>
              <Button
                onClick={() => setStep("api-credentials")}
                disabled={appSecret.trim() === ""}
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        )}

        {step === "api-credentials" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp-token">
                {t("pages.bots.accessToken")}
              </Label>
              <Input
                id="whatsapp-token"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder={t("pages.bots.wizard.placeholders.accessToken")}
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.bots.wizard.whatsapp.accessTokenFieldHint")}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-md">
                {t("pages.bots.wizard.whatsapp.temporaryTokenWarning")}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="whatsapp-phone-number-id">
                {t("pages.bots.phoneNumberId")}
              </Label>
              <Input
                id="whatsapp-phone-number-id"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder={t("pages.bots.wizard.placeholders.phoneNumberId")}
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.bots.wizard.whatsapp.phoneNumberIdFieldHint")}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="whatsapp-waba-id">
                {t("pages.bots.wabaId")}{" "}
                <span className="text-muted-foreground font-normal">
                  {t("pages.bots.optional")}
                </span>
              </Label>
              <Input
                id="whatsapp-waba-id"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                placeholder={t("pages.bots.wabaIdPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.bots.wabaIdHint")}
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError(null);
                  setStep("app-secret");
                }}
                disabled={isSubmitting}
              >
                {t("common.back")}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  accessToken.trim() === "" ||
                  phoneNumberId.trim() === ""
                }
              >
                {isSubmitting ? (
                  <>
                    <Spinner className="h-4 w-4 mr-1" />
                    {t("common.connecting")}
                  </>
                ) : (
                  t("common.next")
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "webhook" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-md font-medium">
                {t("common.created")}
              </span>
              <span className="font-medium">{name}</span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  {t("pages.bots.callbackUrl")}
                </p>
                <CopyableValue value={webhookUrl} />
              </div>

              {createdVerifyToken && (
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    {t("pages.bots.verifyToken")}
                  </p>
                  <CopyableValue value={createdVerifyToken} />
                </div>
              )}

              <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1.5 mt-3">
                <li>
                  {t("pages.bots.whatsappSetup1Before")}{" "}
                  <a
                    href={META_PORTAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    {t("pages.bots.metaDeveloperPortal")}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>{" "}
                  {t("pages.bots.whatsappSetup1After")}
                </li>
              </ol>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep("setup")}>{t("common.next")}</Button>
            </div>
          </div>
        )}

        {step === "setup" && (
          <div className="space-y-4">
            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1.5">
              <li>{t("pages.bots.whatsappSetup2")}</li>
              <li>{t("pages.bots.whatsappSetup3")}</li>
            </ol>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("webhook")}
              >
                {t("common.back")}
              </Button>
              <Button onClick={handleClose}>{t("common.done")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
