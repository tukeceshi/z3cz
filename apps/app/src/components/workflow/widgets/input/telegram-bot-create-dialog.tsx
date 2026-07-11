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
import { createTelegramBot } from "@/services/bot-service";

type Step = "name" | "bot-token" | "setup";

interface TelegramBotCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (botId: string) => void;
}

export function TelegramBotCreateDialog({
  isOpen,
  onClose,
  onCreated,
}: TelegramBotCreateDialogProps) {
  const { organization } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [botToken, setBotToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBotUsername, setCreatedBotUsername] = useState<string | null>(
    null
  );

  const resetForm = () => {
    setStep("name");
    setName("");
    setBotToken("");
    setError(null);
    setCreatedBotUsername(null);
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
      const response = await createTelegramBot(
        { name, botToken },
        organization.id
      );
      setCreatedBotUsername(
        (response.metadata as Record<string, string | undefined> | null)
          ?.botUsername ?? null
      );
      setStep("setup");
      onCreated(response.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pages.bots.wizard.createBotFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[450px]">
        <div>
          <DialogTitle className="text-base font-semibold">
            {step === "name"
              ? t("pages.bots.wizard.telegram.steps.name.title")
              : step === "bot-token"
                ? t("pages.bots.wizard.telegram.steps.botToken.title")
                : t("pages.bots.wizard.telegram.steps.setup.title")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            {step === "name"
              ? t("pages.bots.wizard.telegram.steps.name.description")
              : step === "bot-token"
                ? t("pages.bots.wizard.telegram.steps.botToken.description")
                : t("pages.bots.wizard.telegram.steps.setup.description")}
            {step === "bot-token" && (
              <>
                {" "}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  {t("pages.bots.wizard.telegram.openBotFather")}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </>
            )}
          </DialogDescription>
        </div>

        {step === "name" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="telegram-name">{t("common.name")}</Label>
              <Input
                id="telegram-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("pages.bots.wizard.placeholders.telegramBot")}
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.bots.wizard.botNameHint", { platform: "Telegram" })}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => setStep("bot-token")}
                disabled={name.trim() === ""}
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        )}

        {step === "bot-token" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="telegram-token">{t("pages.bots.botToken")}</Label>
              <Input
                id="telegram-token"
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder={t("pages.bots.wizard.placeholders.botToken")}
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.bots.wizard.telegram.botTokenHint")}{" "}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  @BotFather
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
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
                  setStep("name");
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

        {step === "setup" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-md font-medium">
                {t("common.created")}
              </span>
              <span className="font-medium">
                {name}
                {createdBotUsername && (
                  <span className="text-muted-foreground">
                    {" "}
                    (@{createdBotUsername})
                  </span>
                )}
              </span>
            </div>

            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1.5">
              <li>{t("pages.bots.telegramSetup1")}</li>
              <li>{t("pages.bots.telegramSetup2")}</li>
              <li>
                {t("pages.bots.telegramSetup3Before")}{" "}
                {createdBotUsername ? (
                  <a
                    href={`https://t.me/${createdBotUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    @{createdBotUsername}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                ) : (
                  t("pages.bots.yourBot")
                )}{" "}
                {t("pages.bots.telegramSetup3After")}
              </li>
            </ol>

            <div className="flex justify-end">
              <Button onClick={handleClose}>{t("common.done")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
