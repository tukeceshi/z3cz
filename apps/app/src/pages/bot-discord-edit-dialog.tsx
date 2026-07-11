import type { BotResponse } from "@dafthunk/types";
import { useState } from "react";
import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { updateDiscordBot } from "@/services/bot-service";

interface BotDiscordEditDialogProps {
  bot: BotResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function BotDiscordEditDialog({
  bot,
  open,
  onOpenChange,
  onUpdated,
}: BotDiscordEditDialogProps) {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const meta = (bot.metadata ?? {}) as Record<string, string | undefined>;
  const [name, setName] = useState(bot.name);
  const [publicKey, setPublicKey] = useState(meta.publicKey ?? "");
  const [botToken, setBotToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!organization?.id) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await updateDiscordBot(
        bot.id,
        {
          name: name !== bot.name ? name : undefined,
          publicKey: publicKey !== meta.publicKey ? publicKey : undefined,
          botToken: botToken.trim() !== "" ? botToken : undefined,
        },
        organization.id
      );
      onUpdated();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pages.bots.updateFailed")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setName(bot.name);
      setPublicKey(meta.publicKey ?? "");
      setBotToken("");
      setError(null);
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("pages.bots.editDiscordTitle")}</DialogTitle>
          <DialogDescription>
            {t("pages.bots.editDiscordDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">{t("common.name")}</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("pages.bots.applicationId")}</Label>
            <Input value={meta.applicationId ?? ""} disabled />
            <p className="text-xs text-muted-foreground">
              {t("pages.bots.applicationIdImmutable")}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-public-key">{t("pages.bots.publicKey")}</Label>
            <Input
              id="edit-public-key"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-bot-token">{t("pages.bots.botToken")}</Label>
            <Input
              id="edit-bot-token"
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder={t("pages.bots.tokenKeepPlaceholder")}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || name.trim() === ""}
          >
            {isSubmitting ? <Spinner className="h-4 w-4 mr-2" /> : null}
            {t("pages.bots.saveChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
