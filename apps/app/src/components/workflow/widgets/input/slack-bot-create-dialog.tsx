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
import { createSlackBot } from "@/services/bot-service";

import { CopyableValue } from "./copyable-value";

type Step =
  | "name"
  | "signing-secret"
  | "bot-token"
  | "event-subscriptions"
  | "setup";

const SLACK_STEP_KEYS: Record<
  Step,
  "name" | "signingSecret" | "botToken" | "eventSubscriptions" | "setup"
> = {
  name: "name",
  "signing-secret": "signingSecret",
  "bot-token": "botToken",
  "event-subscriptions": "eventSubscriptions",
  setup: "setup",
};

const SLACK_API_URL = "https://api.slack.com/apps";

interface SlackBotCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (botId: string) => void;
}

export function SlackBotCreateDialog({
  isOpen,
  onClose,
  onCreated,
}: SlackBotCreateDialogProps) {
  const { organization } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [botToken, setBotToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBotId, setCreatedBotId] = useState<string | null>(null);
  const [createdTeamName, setCreatedTeamName] = useState<string | null>(null);

  const stepKey = SLACK_STEP_KEYS[step];

  const resetForm = () => {
    setStep("name");
    setName("");
    setSigningSecret("");
    setBotToken("");
    setError(null);
    setCreatedBotId(null);
    setCreatedTeamName(null);
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
      const response = await createSlackBot(
        { name, botToken, signingSecret },
        organization.id
      );
      setCreatedBotId(response.id);
      setCreatedTeamName(
        (response.metadata as Record<string, string | undefined> | null)
          ?.teamName ?? ""
      );
      setStep("event-subscriptions");
      onCreated(response.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pages.bots.wizard.createBotFailed")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const webhookUrl = createdBotId
    ? `${getApiBaseUrl().replace(/\/$/, "")}/slack/webhook/${createdBotId}`
    : "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[450px]">
        <div>
          <DialogTitle className="text-base font-semibold">
            {t(`pages.bots.wizard.slack.steps.${stepKey}.title`)}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            {t(`pages.bots.wizard.slack.steps.${stepKey}.description`)}
            {(step === "signing-secret" ||
              step === "bot-token" ||
              step === "event-subscriptions") && (
              <>
                {" "}
                <a
                  href={SLACK_API_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  {t("pages.bots.wizard.slack.openSlackApi")}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </>
            )}
          </DialogDescription>
        </div>

        {step === "name" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="slack-name">{t("common.name")}</Label>
              <Input
                id="slack-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("pages.bots.wizard.placeholders.slackBot")}
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.bots.wizard.botNameHint", { platform: "Slack" })}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => setStep("signing-secret")}
                disabled={name.trim() === ""}
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        )}

        {step === "signing-secret" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="slack-signing-secret">
                {t("pages.bots.signingSecret")}
              </Label>
              <Input
                id="slack-signing-secret"
                type="password"
                value={signingSecret}
                onChange={(e) => setSigningSecret(e.target.value)}
                placeholder={t("pages.bots.wizard.placeholders.signingSecret")}
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.bots.wizard.slack.signingSecretHint")}
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
                onClick={() => setStep("bot-token")}
                disabled={signingSecret.trim() === ""}
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        )}

        {step === "bot-token" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="slack-token">
                {t("pages.bots.wizard.slack.botUserOAuthToken")}
              </Label>
              <Input
                id="slack-token"
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder={t("pages.bots.wizard.placeholders.slackBotToken")}
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.bots.wizard.slack.botTokenHint")}
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
                  setStep("signing-secret");
                }}
                disabled={isSubmitting}
              >
                {t("common.back")}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || botToken.trim() === ""}
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

        {step === "event-subscriptions" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-md font-medium">
                {t("common.created")}
              </span>
              <span className="font-medium">
                {name}
                {createdTeamName && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({createdTeamName})
                  </span>
                )}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  {t("pages.bots.wizard.slack.requestUrl")}
                </p>
                <CopyableValue value={webhookUrl} />
              </div>

              <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1.5 mt-3">
                <li>{t("pages.bots.slackSetup1")}</li>
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
              <li>{t("pages.bots.slackSetup2")}</li>
              <li>{t("pages.bots.slackSetup3", { name: name || "botname" })}</li>
              <li>{t("pages.bots.slackSetup4")}</li>
            </ol>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("event-subscriptions")}
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
