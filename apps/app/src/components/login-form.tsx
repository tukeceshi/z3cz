import { JWTTokenPayload, type LegalDocumentType } from "@dafthunk/types";
import { faGithub, faGoogle } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router";
import useSWR, { mutate as mutateGlobal } from "swr";

import { useAuth } from "@/components/auth-context";
import { LanguageToggle } from "@/components/language-toggle";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthError, authService } from "@/services/auth-service";
import { usePublicAuthConfig } from "@/services/auth-config-service";
import { LegalDocumentDialog } from "@/components/legal-document-dialog";
import {
  getDashboardPath,
  mapAuthErrorMessage,
} from "@/utils/auth-navigation";
import { cn } from "@/utils/utils";

interface LoginFormProps extends React.ComponentPropsWithoutRef<"div"> {
  returnTo?: string;
  subAccountInvitationId?: string;
}

const noticeBannerClassName =
  "w-full rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground";

export function LoginForm({
  className,
  returnTo,
  subAccountInvitationId,
  ...props
}: LoginFormProps) {
  const { login, refreshUser } = useAuth();
  const { t, siteSettings } = useTranslation();
  const navigate = useNavigate();
  const clearedStaleSessionRef = useRef(false);
  const { data: setupStatus } = useSWR(
    "/auth/setup-status",
    () => authService.getSetupStatus(),
    {
      revalidateOnFocus: true,
      shouldRetryOnError: true,
    }
  );

  const { data: invitationPreview, error: invitationError } = useSWR(
    subAccountInvitationId
      ? `/auth/sub-account-invitations/${subAccountInvitationId}`
      : null,
    () =>
      authService.getSubAccountInvitationPreview(subAccountInvitationId!),
    { revalidateOnFocus: false }
  );

  const { authConfig } = usePublicAuthConfig();

  const isSubAccountInvite = !!subAccountInvitationId;
  const isBootstrap =
    setupStatus?.hasUsers === false && !isSubAccountInvite;
  const requiresVerification =
    authConfig?.email.requireVerificationOnRegister === true && !isBootstrap;
  const showOAuthProviders =
    !isSubAccountInvite &&
    (authConfig?.github.enabled === true || authConfig?.google.enabled === true);
  const [pendingRegister, setPendingRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [legalDialogType, setLegalDialogType] = useState<LegalDocumentType | null>(
    null
  );

  useEffect(() => {
    if (invitationPreview?.invitation.email) {
      setEmail(invitationPreview.invitation.email);
    }
  }, [invitationPreview?.invitation.email]);

  const clearStaleSessionIfNeeded = async (): Promise<void> => {
    if (!isBootstrap || clearedStaleSessionRef.current) {
      return;
    }

    clearedStaleSessionRef.current = true;
    await authService.clearSession();
  };

  const handleLoginClick = async (provider: "github" | "google") => {
    await login(provider, returnTo);
  };

  const navigateAfterAuth = (user: JWTTokenPayload) => {
    const dashboardPath = getDashboardPath(user);
    if (!dashboardPath) {
      setFormError(t("auth.missingOrgAfterLogin"));
      return;
    }

    if (returnTo) {
      navigate(returnTo);
      return;
    }

    navigate(dashboardPath, { replace: true });
  };

  const handleRegisterAndLogin = async () => {
    setFormError(null);
    setIsSubmitting(true);
    try {
      await clearStaleSessionIfNeeded();
      const user = isSubAccountInvite
        ? await authService.registerSubAccount({
            email,
            password,
            invitationId: subAccountInvitationId!,
            verificationCode: requiresVerification ? verificationCode : undefined,
          })
        : await authService.registerWithPassword(
            email,
            password,
            requiresVerification ? verificationCode : undefined
          );
      setPendingRegister(false);
      setVerificationCode("");
      setCodeSent(false);
      await mutateGlobal("/auth/setup-status");
      await refreshUser();
      navigateAfterAuth(user);
    } catch (error) {
      setFormError(mapAuthErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendVerificationCode = async () => {
    setFormError(null);
    setIsSendingCode(true);
    try {
      await authService.sendRegistrationCode(email);
      setCodeSent(true);
    } catch (error) {
      setFormError(mapAuthErrorMessage(error, t));
    } finally {
      setIsSendingCode(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (isSubAccountInvite || isBootstrap) {
      await handleRegisterAndLogin();
      return;
    }

    if (pendingRegister) {
      await handleRegisterAndLogin();
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await authService.loginWithPassword(email, password);
      await refreshUser();
      navigateAfterAuth(user);
    } catch (error) {
      if (error instanceof AuthError && error.code === "EMAIL_NOT_FOUND") {
        setPendingRegister(true);
        return;
      }

      setFormError(mapAuthErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPendingRegister = () => {
    setPendingRegister(false);
    setVerificationCode("");
    setCodeSent(false);
    setFormError(null);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setPendingRegister(false);
    setVerificationCode("");
    setCodeSent(false);
    setFormError(null);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPendingRegister(false);
    setVerificationCode("");
    setCodeSent(false);
    setFormError(null);
  };

  const showVerificationFields =
    requiresVerification && (pendingRegister || isSubAccountInvite);

  const showTopNoticeBanner = isBootstrap || isSubAccountInvite;
  const showPendingRegisterNotice =
    pendingRegister && !isBootstrap && !isSubAccountInvite;

  const submitButtonLabel = (() => {
    if (isSubmitting) {
      return t("auth.processing");
    }
    if (isSubAccountInvite) {
      return t("auth.createSubAccount");
    }
    if (pendingRegister) {
      return t("auth.confirmRegister");
    }
    return t("auth.loginRegister");
  })();

  if (isSubAccountInvite && invitationError) {
    return (
      <div className={cn("mx-auto flex w-full max-w-sm flex-col gap-4", className)}>
        <Card>
          <CardHeader>
            <CardTitle>{t("auth.subAccountInviteInvalidTitle")}</CardTitle>
            <CardDescription>{t("auth.subAccountInviteInvalidDescription")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("mx-auto flex w-full max-w-sm flex-col gap-4", className)} {...props}>
      <div className="flex justify-end">
        <LanguageToggle />
      </div>
      {showTopNoticeBanner && (
        <div className={noticeBannerClassName} role="status">
          {isBootstrap && (
            <div>
              <p className="font-medium">{t("auth.bootstrapTitle")}</p>
              <p className="mt-1 text-muted-foreground">
                {t("auth.bootstrapDescription")}
              </p>
            </div>
          )}
          {isSubAccountInvite && invitationPreview && (
            <div>
              <p className="font-medium">{t("auth.subAccountInviteTitle")}</p>
              <p className="mt-1 text-muted-foreground">
                {t("auth.subAccountInviteDescription", {
                  organization: invitationPreview.invitation.organizationName,
                })}
              </p>
            </div>
          )}
        </div>
      )}

      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl flex justify-center">
            <a href="/" className="flex items-center gap-3">
              <img
                src="/icon.svg"
                alt={siteSettings.siteName}
                className="h-8 w-8 dark:invert"
              />
              <span className="text-2xl font-semibold text-foreground">
                {siteSettings.siteName}
              </span>
            </a>
          </CardTitle>
          <CardDescription>{siteSettings.siteTagline}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <form className="grid gap-4" onSubmit={handlePasswordSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => handleEmailChange(event.target.value)}
                  disabled={isSubAccountInvite}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={
                    isBootstrap || pendingRegister || isSubAccountInvite
                      ? "new-password"
                      : "current-password"
                  }
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) =>
                    handlePasswordChange(event.target.value)
                  }
                />
              </div>
              {showVerificationFields && (pendingRegister || isSubAccountInvite) && (
                <div className="grid gap-2">
                  <Label htmlFor="verificationCode">{t("auth.verificationCode")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="verificationCode"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={verificationCode}
                      onChange={(event) =>
                        setVerificationCode(event.target.value)
                      }
                      maxLength={6}
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSendingCode || !email.trim()}
                      onClick={handleSendVerificationCode}
                    >
                      {isSendingCode
                        ? t("auth.processing")
                        : codeSent
                          ? t("auth.resendVerificationCode")
                          : t("auth.sendVerificationCode")}
                    </Button>
                  </div>
                  {codeSent && (
                    <p className="text-xs text-muted-foreground">
                      {t("auth.verificationCodeSent")}
                    </p>
                  )}
                </div>
              )}
              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {submitButtonLabel}
              </Button>
              {showPendingRegisterNotice && (
                <div className={noticeBannerClassName} role="status">
                  <p className="font-medium">{t("auth.pendingRegisterTitle")}</p>
                  <p className="mt-1 text-muted-foreground">
                    {t("auth.pendingRegisterDescription")}
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="mt-2 h-auto p-0 text-muted-foreground"
                    disabled={isSubmitting}
                    onClick={handleCancelPendingRegister}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              )}
            </form>

            {!isSubAccountInvite && showOAuthProviders && (
              <>
            <div className="relative text-center text-xs uppercase text-muted-foreground">
              <span className="bg-card px-2 relative z-10">{t("auth.or")}</span>
              <div className="absolute inset-x-0 top-1/2 border-t" />
            </div>
            <div className="flex flex-col gap-4">
              {authConfig?.google.enabled && (
              <Button
                onClick={() => handleLoginClick("google")}
                variant="outline"
                className="w-full"
              >
                <FontAwesomeIcon icon={faGoogle} className="w-5 h-5 mr-2" />
                {t("auth.loginWithGoogle")}
              </Button>
              )}
              {authConfig?.github.enabled && (
              <Button
                onClick={() => handleLoginClick("github")}
                variant="outline"
                className="w-full"
              >
                <FontAwesomeIcon icon={faGithub} className="w-5 h-5 mr-2" />
                {t("auth.loginWithGithub")}
              </Button>
              )}
            </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground">
        {t("auth.termsPrefix")}{" "}
        <button
          type="button"
          className="underline hover:text-neutral-700"
          onClick={() => setLegalDialogType("terms")}
        >
          {t("auth.termsOfService")}
        </button>{" "}
        {t("auth.and")}{" "}
        <button
          type="button"
          className="underline hover:text-neutral-700"
          onClick={() => setLegalDialogType("privacy")}
        >
          {t("auth.privacyPolicy")}
        </button>
        .
      </div>
      <LegalDocumentDialog
        type={legalDialogType}
        open={legalDialogType !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLegalDialogType(null);
          }
        }}
      />
    </div>
  );
}
