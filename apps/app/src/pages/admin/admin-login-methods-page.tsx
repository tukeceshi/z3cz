import type { UpdateAuthConfigRequest } from "@dafthunk/types";
import {
  AUTH_CONFIG_SECRET_MASK,
  isSmtpConfigured,
  type AdminAuthConfig,
  type EmailAuthConfig,
  type OAuthProviderAuthConfig,
} from "@dafthunk/types";
import KeyRound from "lucide-react/icons/key-round";
import Mail from "lucide-react/icons/mail";
import { useEffect, useMemo, useState } from "react";

import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CredentialPlainInput,
  CredentialSecretInput,
} from "@/components/credential-secret-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  updateAdminAuthConfig,
  useAdminAuthConfig,
} from "@/services/auth-config-service";

interface EmailFormState {
  requireVerificationOnRegister: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  fromAddress: string;
  smtpPasswordConfigured: boolean;
}

interface OAuthFormState {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  clientSecretConfigured: boolean;
}

function toEmailForm(config: AdminAuthConfig["email"]): EmailFormState {
  return {
    requireVerificationOnRegister: config.requireVerificationOnRegister,
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort ? String(config.smtpPort) : "",
    smtpUser: config.smtpUser,
    smtpPassword: config.smtpPasswordConfigured ? AUTH_CONFIG_SECRET_MASK : "",
    fromAddress: config.fromAddress,
    smtpPasswordConfigured: config.smtpPasswordConfigured,
  };
}

function toOAuthForm(
  config: AdminAuthConfig["github"] | AdminAuthConfig["google"]
): OAuthFormState {
  return {
    enabled: config.enabled,
    clientId: config.clientId,
    clientSecret: config.clientSecretConfigured ? AUTH_CONFIG_SECRET_MASK : "",
    clientSecretConfigured: config.clientSecretConfigured,
  };
}

function canEnableEmailVerification(form: EmailFormState): boolean {
  const emailConfig: EmailAuthConfig = {
    requireVerificationOnRegister: form.requireVerificationOnRegister,
    smtpHost: form.smtpHost,
    smtpPort: form.smtpPort ? Number(form.smtpPort) : null,
    smtpUser: form.smtpUser,
    smtpPassword:
      form.smtpPassword === AUTH_CONFIG_SECRET_MASK
        ? "configured"
        : form.smtpPassword,
    fromAddress: form.fromAddress,
  };

  return isSmtpConfigured(emailConfig) || form.fromAddress.trim().length > 0;
}

function canEnableOAuth(form: OAuthFormState): boolean {
  const hasClientId = form.clientId.trim().length > 0;
  const hasSecret =
    form.clientSecretConfigured ||
    (form.clientSecret.trim().length > 0 &&
      form.clientSecret !== AUTH_CONFIG_SECRET_MASK);
  return hasClientId && hasSecret;
}

function buildEmailUpdate(form: EmailFormState): UpdateAuthConfigRequest["email"] {
  return {
    requireVerificationOnRegister: form.requireVerificationOnRegister,
    smtpHost: form.smtpHost.trim(),
    smtpPort: form.smtpPort.trim() ? Number(form.smtpPort) : null,
    smtpUser: form.smtpUser.trim(),
    fromAddress: form.fromAddress.trim(),
    ...(form.smtpPassword &&
    form.smtpPassword !== AUTH_CONFIG_SECRET_MASK &&
    form.smtpPassword.trim().length > 0
      ? { smtpPassword: form.smtpPassword }
      : {}),
  };
}

function buildOAuthUpdate(
  form: OAuthFormState
): Partial<OAuthProviderAuthConfig> & { clientSecret?: string } {
  return {
    enabled: form.enabled,
    clientId: form.clientId.trim(),
    ...(form.clientSecret &&
    form.clientSecret !== AUTH_CONFIG_SECRET_MASK &&
    form.clientSecret.trim().length > 0
      ? { clientSecret: form.clientSecret }
      : {}),
  };
}

export function AdminLoginMethodsPage() {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const setBreadcrumbs = useBreadcrumbsSetter();
  const { authConfig, authConfigError, isAuthConfigLoading, refreshAuthConfig } =
    useAdminAuthConfig();

  const [emailForm, setEmailForm] = useState<EmailFormState | null>(null);
  const [githubForm, setGithubForm] = useState<OAuthFormState | null>(null);
  const [googleForm, setGoogleForm] = useState<OAuthFormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: t("loginMethods.title") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  useEffect(() => {
    if (!authConfig) {
      return;
    }
    setEmailForm(toEmailForm(authConfig.email));
    setGithubForm(toOAuthForm(authConfig.github));
    setGoogleForm(toOAuthForm(authConfig.google));
  }, [authConfig]);

  const emailVerificationReady = useMemo(
    () => (emailForm ? canEnableEmailVerification(emailForm) : false),
    [emailForm]
  );

  const githubReady = useMemo(
    () => (githubForm ? canEnableOAuth(githubForm) : false),
    [githubForm]
  );

  const googleReady = useMemo(
    () => (googleForm ? canEnableOAuth(googleForm) : false),
    [googleForm]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!emailForm || !githubForm || !googleForm) {
      return;
    }

    setIsSaving(true);
    try {
      await updateAdminAuthConfig({
        email: buildEmailUpdate(emailForm),
        github: buildOAuthUpdate(githubForm),
        google: buildOAuthUpdate(googleForm),
      });
      await refreshAuthConfig();
      appToast.success(t("loginMethods.saveSuccess"));
    } catch {
      appToast.error(t("loginMethods.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isAuthConfigLoading || !emailForm || !githubForm || !googleForm) {
    return <InsetLoading title={t("loginMethods.title")} />;
  }

  if (authConfigError) {
    return (
      <InsetError
        title={t("loginMethods.title")}
        errorMessage={authConfigError.message}
      />
    );
  }

  return (
    <InsetLayout title={t("loginMethods.title")}>
      <form
        className="flex max-w-2xl flex-col gap-6"
        autoComplete="off"
        onSubmit={handleSubmit}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-4" />
              {t("loginMethods.email.title")}
            </CardTitle>
            <CardDescription>{t("loginMethods.email.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("loginMethods.email.alwaysAvailable")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="login-methods-from-address">
                  {t("loginMethods.email.fromAddress")}
                </Label>
                <CredentialPlainInput
                  id="login-methods-from-address"
                  name="auth_config_from_address"
                  value={emailForm.fromAddress}
                  onChange={(event) =>
                    setEmailForm((current) =>
                      current
                        ? { ...current, fromAddress: event.target.value }
                        : current
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-methods-smtp-host">
                  {t("loginMethods.email.smtpHost")}
                </Label>
                <CredentialPlainInput
                  id="login-methods-smtp-host"
                  name="auth_config_smtp_host"
                  value={emailForm.smtpHost}
                  onChange={(event) =>
                    setEmailForm((current) =>
                      current ? { ...current, smtpHost: event.target.value } : current
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-methods-smtp-port">
                  {t("loginMethods.email.smtpPort")}
                </Label>
                <CredentialPlainInput
                  id="login-methods-smtp-port"
                  name="auth_config_smtp_port"
                  inputMode="numeric"
                  value={emailForm.smtpPort}
                  onChange={(event) =>
                    setEmailForm((current) =>
                      current ? { ...current, smtpPort: event.target.value } : current
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-methods-smtp-user">
                  {t("loginMethods.email.smtpUser")}
                </Label>
                <CredentialPlainInput
                  id="login-methods-smtp-user"
                  name="auth_config_smtp_user"
                  value={emailForm.smtpUser}
                  onChange={(event) =>
                    setEmailForm((current) =>
                      current ? { ...current, smtpUser: event.target.value } : current
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-methods-smtp-password">
                  {t("loginMethods.email.smtpPassword")}
                </Label>
                <CredentialSecretInput
                  id="login-methods-smtp-password"
                  name="auth_config_smtp_password"
                  value={emailForm.smtpPassword}
                  placeholder={
                    emailForm.smtpPasswordConfigured
                      ? AUTH_CONFIG_SECRET_MASK
                      : undefined
                  }
                  onChange={(event) =>
                    setEmailForm((current) =>
                      current
                        ? { ...current, smtpPassword: event.target.value }
                        : current
                    )
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium">
                  {t("loginMethods.email.verificationToggle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("loginMethods.email.verificationHint")}
                </p>
              </div>
              <Switch
                checked={emailForm.requireVerificationOnRegister}
                disabled={!emailVerificationReady}
                onCheckedChange={(checked) =>
                  setEmailForm((current) =>
                    current
                      ? { ...current, requireVerificationOnRegister: checked }
                      : current
                  )
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" />
              {t("loginMethods.github.title")}
            </CardTitle>
            <CardDescription>{t("loginMethods.github.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-methods-github-client-id">
                {t("loginMethods.oauth.clientId")}
              </Label>
              <CredentialPlainInput
                id="login-methods-github-client-id"
                name="auth_config_github_client_id"
                value={githubForm.clientId}
                onChange={(event) =>
                  setGithubForm((current) =>
                    current ? { ...current, clientId: event.target.value } : current
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-methods-github-client-secret">
                {t("loginMethods.oauth.clientSecret")}
              </Label>
              <CredentialSecretInput
                id="login-methods-github-client-secret"
                name="auth_config_github_client_secret"
                value={githubForm.clientSecret}
                placeholder={
                  githubForm.clientSecretConfigured ? AUTH_CONFIG_SECRET_MASK : undefined
                }
                onChange={(event) =>
                  setGithubForm((current) =>
                    current
                      ? { ...current, clientSecret: event.target.value }
                      : current
                  )
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <p className="text-sm font-medium">{t("loginMethods.oauth.enable")}</p>
              <Switch
                checked={githubForm.enabled}
                disabled={!githubReady}
                onCheckedChange={(checked) =>
                  setGithubForm((current) =>
                    current ? { ...current, enabled: checked } : current
                  )
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" />
              {t("loginMethods.google.title")}
            </CardTitle>
            <CardDescription>{t("loginMethods.google.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-methods-google-client-id">
                {t("loginMethods.oauth.clientId")}
              </Label>
              <CredentialPlainInput
                id="login-methods-google-client-id"
                name="auth_config_google_client_id"
                value={googleForm.clientId}
                onChange={(event) =>
                  setGoogleForm((current) =>
                    current ? { ...current, clientId: event.target.value } : current
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-methods-google-client-secret">
                {t("loginMethods.oauth.clientSecret")}
              </Label>
              <CredentialSecretInput
                id="login-methods-google-client-secret"
                name="auth_config_google_client_secret"
                value={googleForm.clientSecret}
                placeholder={
                  googleForm.clientSecretConfigured ? AUTH_CONFIG_SECRET_MASK : undefined
                }
                onChange={(event) =>
                  setGoogleForm((current) =>
                    current
                      ? { ...current, clientSecret: event.target.value }
                      : current
                  )
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <p className="text-sm font-medium">{t("loginMethods.oauth.enable")}</p>
              <Switch
                checked={googleForm.enabled}
                disabled={!googleReady}
                onCheckedChange={(checked) =>
                  setGoogleForm((current) =>
                    current ? { ...current, enabled: checked } : current
                  )
                }
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={isSaving}>
          {isSaving ? t("loginMethods.saving") : t("loginMethods.save")}
        </Button>
      </form>
    </InsetLayout>
  );
}
