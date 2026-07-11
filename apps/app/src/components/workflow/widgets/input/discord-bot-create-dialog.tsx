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
import { createDiscordBot } from "@/services/bot-service";

import { CopyableValue } from "./copyable-value";

type Step =
  | "name"
  | "application"
  | "bot-token"
  | "webhook"
  | "command"
  | "invite";

interface DiscordBotCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (botId: string) => void;
  onCommandNameSet?: (commandName: string) => void;
  showCommandStep?: boolean;
}

export function DiscordBotCreateDialog({
  isOpen,
  onClose,
  onCreated,
  onCommandNameSet,
  showCommandStep = true,
}: DiscordBotCreateDialogProps) {
  const { organization } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [botToken, setBotToken] = useState("");
  const [commandName, setCommandName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBotId, setCreatedBotId] = useState<string | null>(null);

  const resetForm = () => {
    setStep("name");
    setName("");
    setApplicationId("");
    setPublicKey("");
    setBotToken("");
    setCommandName("");
    setError(null);
    setCreatedBotId(null);
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
      const response = await createDiscordBot(
        { name, botToken, applicationId, publicKey },
        organization.id
      );
      setCreatedBotId(response.id);
      setStep("webhook");
      onCreated(response.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pages.bots.wizard.createBotFailed")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommandNext = () => {
    if (commandName.trim() && onCommandNameSet) {
      onCommandNameSet(commandName.trim());
    }
    setStep("invite");
  };

  const generalInfoUrl = applicationId
    ? `https://discord.com/developers/applications/${applicationId}/information`
    : "https://discord.com/developers/applications";

  const botSettingsUrl = applicationId
    ? `https://discord.com/developers/applications/${applicationId}/bot`
    : "https://discord.com/developers/applications";

  const webhookUrl = createdBotId
    ? `${getApiBaseUrl().replace(/\/$/, "")}/discord/webhook/${createdBotId}`
    : "";

  const inviteUrl = applicationId
    ? `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=bot+applications.commands&permissions=2048`
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[450px]">
        <div>
          <DialogTitle className="text-base font-semibold">
            {step === "name"
              ? t("pages.bots.wizard.discord.steps.name.title")
              : step === "application"
                ? t("pages.bots.wizard.discord.steps.application.title")
                : step === "bot-token"
                  ? t("pages.bots.wizard.discord.steps.botToken.title")
                  : step === "webhook"
                    ? t("pages.bots.wizard.discord.steps.webhook.title")
                    : step === "command"
                      ? t("pages.bots.wizard.discord.steps.command.title")
                      : t("pages.bots.wizard.discord.steps.invite.title")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            {step === "name"
              ? t("pages.bots.wizard.discord.steps.name.description")
              : step === "application"
                ? t("pages.bots.wizard.discord.steps.application.description")
                : step === "bot-token"
                  ? t("pages.bots.wizard.discord.steps.botToken.description")
                  : step === "webhook"
                    ? t("pages.bots.wizard.discord.steps.webhook.description")
                    : step === "command"
                      ? t("pages.bots.wizard.discord.steps.command.description")
                      : t("pages.bots.wizard.discord.steps.invite.description")}
            {(step === "application" || step === "webhook") && (
              <>
                {" "}
                <a
                  href={generalInfoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  {t("pages.bots.openDiscordDevPortal")}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </>
            )}
            {step === "bot-token" && (
              <>
                {" "}
                <a
                  href={botSettingsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  {t("pages.bots.openDiscordDevPortal")}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </>
            )}
          </DialogDescription>
        </div>

        {step === "name" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="discord-name">{t("common.name")}</Label>
              <Input
                id="discord-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("pages.bots.wizard.placeholders.discordBot")}
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.bots.wizard.botNameHint", { platform: "Discord" })}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => setStep("application")}
                disabled={name.trim() === ""}
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        )}

        {step === "application" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="discord-app-id">
                {t("pages.bots.applicationId")}
              </Label>
              <Input
                id="discord-app-id"
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                placeholder={t("pages.bots.wizard.placeholders.applicationId")}
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.bots.wizard.discord.applicationIdHint")}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="discord-public-key">
                {t("pages.bots.publicKey")}
              </Label>
              <Input
                id="discord-public-key"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder={t("pages.bots.wizard.placeholders.publicKey")}
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.bots.wizard.discord.publicKeyHint")}
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
                disabled={
                  applicationId.trim() === "" || publicKey.trim() === ""
                }
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        )}

        {step === "bot-token" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="discord-token">{t("pages.bots.botToken")}</Label>
              <Input
                id="discord-token"
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder={t("pages.bots.wizard.placeholders.botToken")}
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.bots.wizard.discord.botTokenHint")}
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
                  setStep("application");
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
                  {t("pages.bots.wizard.discord.interactionsEndpointUrl")}
                </p>
                <CopyableValue value={webhookUrl} />
                <p className="text-muted-foreground text-xs">
                  {t("pages.bots.wizard.discord.webhookPasteHint")}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(showCommandStep ? "command" : "invite")}
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        )}

        {step === "command" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="discord-command">
                {t("pages.bots.wizard.discord.commandName")}
              </Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">/</span>
                <Input
                  id="discord-command"
                  value={commandName}
                  onChange={(e) => setCommandName(e.target.value)}
                  placeholder={t("pages.bots.wizard.placeholders.commandName")}
                  className="font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("pages.bots.wizard.discord.commandHint", {
                  command: commandName || "command",
                })}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("webhook")}
              >
                {t("common.back")}
              </Button>
              <Button
                onClick={handleCommandNext}
                disabled={commandName.trim() === ""}
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        )}

        {step === "invite" && (
          <div className="space-y-4">
            {inviteUrl && (
              <div className="bg-muted/50 p-3 rounded-md">
                <a
                  href={inviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  {t("pages.bots.wizard.discord.addToServer", { name })}
                  <ExternalLink className="w-3 h-3" />
                </a>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("pages.bots.wizard.discord.invitePermissionsHint")}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(showCommandStep ? "command" : "webhook")}
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
