import type { IntegrationProvider } from "@dafthunk/types";
import ExternalLink from "lucide-react/icons/external-link";
import { useEffect, useMemo, useState } from "react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAvailableProviders } from "../hooks/use-available-providers";
import { useIntegrationActions } from "../hooks/use-integration-actions";
import { getAvailableProviders, getProviderLabel } from "../providers";

interface IntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IntegrationDialog({
  open,
  onOpenChange,
}: IntegrationDialogProps) {
  const { t } = useTranslation();
  const { isProcessing, connectOAuth, createManual } = useIntegrationActions();
  const { providers: availableProviderIds, isLoading: isLoadingProviders } =
    useAvailableProviders();

  const [selectedProvider, setSelectedProvider] =
    useState<IntegrationProvider | null>(null);
  const [integrationName, setIntegrationName] = useState("");
  const [apiKey, setApiKey] = useState("");

  const providers = useMemo(
    () =>
      availableProviderIds && availableProviderIds.length > 0
        ? getAvailableProviders(availableProviderIds)
        : [],
    [availableProviderIds]
  );

  const currentProvider = useMemo(
    () => providers.find((p) => p.id === selectedProvider),
    [providers, selectedProvider]
  );

  useEffect(() => {
    if (!selectedProvider && providers.length > 0) {
      setSelectedProvider(providers[0].id);
    }
  }, [providers, selectedProvider]);

  const resetForm = () => {
    setIntegrationName("");
    setApiKey("");
    setSelectedProvider(providers.length > 0 ? providers[0].id : null);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const handleConnect = async () => {
    if (!currentProvider || !selectedProvider) return;

    if (currentProvider.supportsOAuth) {
      connectOAuth(selectedProvider);
      handleClose();
    } else {
      if (!integrationName || !apiKey) return;

      try {
        await createManual(selectedProvider, integrationName, apiKey);
        handleClose();
      } catch {
        // Error is already handled in the hook
      }
    }
  };

  let content: React.ReactNode;
  let footer: React.ReactNode;

  if (isLoadingProviders) {
    content = (
      <DialogDescription>{t("pages.integrations.dialog.loading")}</DialogDescription>
    );
  } else if (providers.length === 0) {
    content = (
      <DialogDescription>
        {t("pages.integrations.dialog.noProviders")}
      </DialogDescription>
    );
    footer = (
      <Button onClick={handleClose}>{t("pages.integrations.dialog.close")}</Button>
    );
  } else {
    const isOAuth = currentProvider?.supportsOAuth;
    const canSubmit = isOAuth || (integrationName && apiKey);
    const providerLabel = selectedProvider
      ? getProviderLabel(selectedProvider)
      : "...";

    content = (
      <>
        <DialogDescription>
          {t("pages.integrations.dialog.description")}
        </DialogDescription>
        <div className="space-y-4">
          <div>
            <Label htmlFor="provider">
              {t("pages.integrations.dialog.provider")}
            </Label>
            <Select
              value={selectedProvider || undefined}
              onValueChange={(value) =>
                setSelectedProvider(value as IntegrationProvider)
              }
            >
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-2">
              {currentProvider?.description}
            </p>
          </div>

          {!isOAuth && (
            <>
              {currentProvider?.apiKeyInstructions && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground">
                    {currentProvider.apiKeyInstructions}
                  </p>
                  {currentProvider.apiKeyUrl && (
                    <Button
                      variant="link"
                      className="h-auto p-0 mt-2 text-xs"
                      asChild
                    >
                      <a
                        href={currentProvider.apiKeyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t("pages.integrations.dialog.getApiKey")}
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              )}
              <div>
                <Label htmlFor="integration-name">
                  {t("pages.integrations.dialog.integrationName")}
                </Label>
                <Input
                  id="integration-name"
                  placeholder={t(
                    "pages.integrations.dialog.integrationNamePlaceholder"
                  )}
                  value={integrationName}
                  onChange={(e) => setIntegrationName(e.target.value)}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {t("pages.integrations.dialog.savedAs", {
                    provider: providerLabel,
                    name: integrationName || "...",
                  })}
                </p>
              </div>
              <div>
                <Label htmlFor="api-key">
                  {t("pages.integrations.dialog.apiKey")}
                </Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder={t("pages.integrations.dialog.apiKeyPlaceholder")}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </>
    );

    footer = (
      <>
        <Button variant="outline" onClick={handleClose}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleConnect} disabled={isProcessing || !canSubmit}>
          {isProcessing
            ? t("pages.integrations.dialog.processing")
            : isOAuth
              ? t("pages.integrations.dialog.connect")
              : t("pages.integrations.dialog.addIntegration")}
        </Button>
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("pages.integrations.dialog.title")}</DialogTitle>
          {content}
        </DialogHeader>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
