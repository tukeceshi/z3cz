import type {
  CreatePlatformRelayAccountRequest,
  PlatformRelayAccount,
  UpdatePlatformRelayAccountRequest,
} from "@dafthunk/types";
import { useEffect, useState } from "react";

import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  createAdminPlatformRelayAccount,
  deleteAdminPlatformRelayAccount,
  updateAdminPlatformRelayAccount,
  useAdminPlatformRelayAccounts,
} from "@/services/platform-relay-account-service";

interface AccountFormState {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  isDefault: boolean;
}

const emptyForm = (): AccountFormState => ({
  id: "",
  name: "",
  baseUrl: "",
  apiKey: "",
  enabled: true,
  isDefault: false,
});

function formFromAccount(account: PlatformRelayAccount): AccountFormState {
  return {
    id: account.id,
    name: account.name,
    baseUrl: account.baseUrl,
    apiKey: "",
    enabled: account.enabled,
    isDefault: account.isDefault,
  };
}

export function AdminPlatformRelayAccountsPage() {
  const { accounts, accountsError, isAccountsLoading, refreshAccounts } =
    useAdminPlatformRelayAccounts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PlatformRelayAccount | null>(
    null
  );
  const [form, setForm] = useState<AccountFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const setBreadcrumbs = useBreadcrumbsSetter();
  const { t } = useTranslation();
  const appToast = useAppToast();

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.admin"), to: "/admin" },
      { label: t("sidebar.relayAccounts") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  const handleOpenCreate = () => {
    setEditingAccount(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const handleOpenEdit = (account: PlatformRelayAccount) => {
    setEditingAccount(account);
    setForm(formFromAccount(account));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editingAccount) {
        const payload: UpdatePlatformRelayAccountRequest = {
          name: form.name,
          baseUrl: form.baseUrl,
          enabled: form.enabled,
          isDefault: form.isDefault,
          ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
        };
        await updateAdminPlatformRelayAccount(editingAccount.id, payload);
        appToast.success("admin.relayAccounts.updated");
      } else {
        const payload: CreatePlatformRelayAccountRequest = {
          ...(form.id.trim() ? { id: form.id.trim() } : {}),
          name: form.name.trim(),
          provider: "newapi",
          baseUrl: form.baseUrl.trim(),
          apiKey: form.apiKey.trim(),
          enabled: form.enabled,
          isDefault: form.isDefault,
        };
        await createAdminPlatformRelayAccount(payload);
        appToast.success("admin.relayAccounts.created");
      }

      setDialogOpen(false);
      await refreshAccounts();
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error ? error.message : t("admin.relayAccounts.saveFailed")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (account: PlatformRelayAccount) => {
    if (!window.confirm(t("admin.relayAccounts.deleteConfirm", { name: account.name }))) {
      return;
    }

    try {
      await deleteAdminPlatformRelayAccount(account.id);
      appToast.success("admin.relayAccounts.deleted");
      await refreshAccounts();
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error ? error.message : t("admin.relayAccounts.deleteFailed")
      );
    }
  };

  if (isAccountsLoading) {
    return <InsetLoading title={t("admin.relayAccounts.title")} />;
  }

  if (accountsError) {
    return (
      <InsetError
        title={t("admin.relayAccounts.title")}
        errorMessage={t("admin.relayAccounts.loadFailed")}
      />
    );
  }

  return (
    <InsetLayout
      title={t("admin.relayAccounts.title")}
      titleRight={
        <Button onClick={handleOpenCreate}>{t("admin.relayAccounts.add")}</Button>
      }
    >
      <p className="mb-6 text-sm text-muted-foreground">
        {t("admin.relayAccounts.description")}
      </p>
      <div className="rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.relayAccounts.columns.name")}</TableHead>
            <TableHead>{t("admin.relayAccounts.columns.provider")}</TableHead>
            <TableHead>{t("admin.relayAccounts.columns.baseUrl")}</TableHead>
            <TableHead>{t("admin.relayAccounts.columns.status")}</TableHead>
            <TableHead className="text-right">
              {t("admin.relayAccounts.columns.actions")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                {t("admin.relayAccounts.empty")}
              </TableCell>
            </TableRow>
          ) : (
            accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell>
                  <div className="font-medium">{account.name}</div>
                  <div className="text-xs text-muted-foreground">{account.id}</div>
                </TableCell>
                <TableCell>{account.provider}</TableCell>
                <TableCell className="max-w-xs truncate">{account.baseUrl}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {account.enabled ? (
                      <Badge variant="secondary">
                        {t("admin.relayAccounts.enabled")}
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        {t("admin.relayAccounts.disabled")}
                      </Badge>
                    )}
                    {account.isDefault ? (
                      <Badge>{t("admin.relayAccounts.default")}</Badge>
                    ) : null}
                    {account.hasApiKey ? (
                      <Badge variant="outline">
                        {t("admin.relayAccounts.keySet")}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(account)}
                    >
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={account.isDefault}
                      onClick={() => handleDelete(account)}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAccount
                ? t("admin.relayAccounts.edit")
                : t("admin.relayAccounts.add")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!editingAccount ? (
              <div className="space-y-2">
                <Label htmlFor="relay-id">{t("admin.relayAccounts.idOptional")}</Label>
                <Input
                  id="relay-id"
                  placeholder="my-newapi-relay"
                  value={form.id}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, id: event.target.value }))
                  }
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="relay-name">{t("common.name")}</Label>
              <Input
                id="relay-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="relay-base-url">
                {t("admin.relayAccounts.baseUrl")}
              </Label>
              <Input
                id="relay-base-url"
                placeholder="https://relay.example.com"
                value={form.baseUrl}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    baseUrl: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="relay-api-key">
                {editingAccount
                  ? t("admin.relayAccounts.apiKeyKeep")
                  : t("admin.relayAccounts.apiKey")}
              </Label>
              <Input
                id="relay-api-key"
                type="password"
                value={form.apiKey}
                onChange={(event) =>
                  setForm((current) => ({ ...current, apiKey: event.target.value }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="relay-enabled">
                {t("admin.relayAccounts.enabled")}
              </Label>
              <Switch
                id="relay-enabled"
                checked={form.enabled}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, enabled: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="relay-default">
                {t("admin.relayAccounts.defaultAccount")}
              </Label>
              <Switch
                id="relay-default"
                checked={form.isDefault}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, isDefault: checked }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={
                isSaving ||
                !form.name.trim() ||
                !form.baseUrl.trim() ||
                (!editingAccount && !form.apiKey.trim())
              }
              onClick={handleSave}
            >
              {isSaving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </InsetLayout>
  );
}
