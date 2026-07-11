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
import { updateWhatsAppAccount } from "@/services/bot-service";

interface BotWhatsAppEditDialogProps {
  account: BotResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function BotWhatsAppEditDialog({
  account,
  open,
  onOpenChange,
  onUpdated,
}: BotWhatsAppEditDialogProps) {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const meta = (account.metadata ?? {}) as Record<string, string | undefined>;
  const [name, setName] = useState(account.name);
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState(meta.phoneNumberId ?? "");
  const [appSecret, setAppSecret] = useState("");
  const [wabaId, setWabaId] = useState(meta.wabaId ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!organization?.id) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await updateWhatsAppAccount(
        account.id,
        {
          name: name !== account.name ? name : undefined,
          accessToken: accessToken.trim() !== "" ? accessToken : undefined,
          phoneNumberId:
            phoneNumberId !== meta.phoneNumberId ? phoneNumberId : undefined,
          appSecret: appSecret.trim() !== "" ? appSecret : undefined,
          wabaId:
            wabaId !== (meta.wabaId || "") ? wabaId || undefined : undefined,
        },
        organization.id
      );
      onUpdated();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pages.bots.updateAccountFailed")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setName(account.name);
      setAccessToken("");
      setPhoneNumberId(meta.phoneNumberId ?? "");
      setAppSecret("");
      setWabaId(meta.wabaId || "");
      setError(null);
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("pages.bots.editWhatsAppTitle")}</DialogTitle>
          <DialogDescription>
            {t("pages.bots.editWhatsAppDescription")}
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
            <p className="text-xs text-muted-foreground">
              {t("pages.bots.displayNameHint")}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-app-secret">{t("pages.bots.appSecret")}</Label>
            <Input
              id="edit-app-secret"
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder={t("pages.bots.secretKeepPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("pages.bots.appSecretHint")}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-access-token">
              {t("pages.bots.accessToken")}
            </Label>
            <Input
              id="edit-access-token"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={t("pages.bots.tokenKeepPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("pages.bots.accessTokenHint")}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-phone-number-id">
              {t("pages.bots.phoneNumberId")}
            </Label>
            <Input
              id="edit-phone-number-id"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("pages.bots.phoneNumberIdHint")}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-waba-id">
              {t("pages.bots.wabaId")}{" "}
              <span className="text-muted-foreground font-normal">
                {t("pages.bots.optional")}
              </span>
            </Label>
            <Input
              id="edit-waba-id"
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
