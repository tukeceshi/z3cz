import { JWTTokenPayload } from "@dafthunk/types";
import { faGithub, faGoogle } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRef, useState } from "react";
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
import {
  getDashboardPath,
  mapAuthErrorMessage,
} from "@/utils/auth-navigation";
import { cn } from "@/utils/utils";

interface LoginFormProps extends React.ComponentPropsWithoutRef<"div"> {
  returnTo?: string;
}

export function LoginForm({ className, returnTo, ...props }: LoginFormProps) {
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

  const isBootstrap = setupStatus?.hasUsers === false;
  const [pendingRegister, setPendingRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const user = await authService.registerWithPassword(email, password);
      setPendingRegister(false);
      await mutateGlobal("/auth/setup-status");
      await refreshUser();
      navigateAfterAuth(user);
    } catch (error) {
      setFormError(mapAuthErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (isBootstrap || pendingRegister) {
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

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setPendingRegister(false);
    setFormError(null);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPendingRegister(false);
    setFormError(null);
  };

  const showNoticeBanner = isBootstrap || pendingRegister;

  return (
    <div className={cn("mx-auto flex w-full max-w-sm flex-col gap-4", className)} {...props}>
      <div className="flex justify-end">
        <LanguageToggle />
      </div>
      {showNoticeBanner && (
        <div
          className={cn(
            "w-full rounded-lg border px-4 py-3 text-sm",
            "border-red-300 bg-red-100 text-red-950",
            "dark:border-red-700 dark:bg-red-900/60 dark:text-red-50"
          )}
          role="status"
        >
          {isBootstrap && (
            <div
              className={cn(
                pendingRegister &&
                  "pb-3 border-b border-red-300/80 dark:border-red-700/80"
              )}
            >
              <p className="font-medium">{t("auth.bootstrapTitle")}</p>
              <p className="mt-1 text-red-900/90 dark:text-red-50/90">
                {t("auth.bootstrapDescription")}
              </p>
            </div>
          )}
          {pendingRegister && !isBootstrap && (
            <div>
              <p className="font-medium">{t("auth.pendingRegisterTitle")}</p>
              <p className="mt-1 text-red-900/90 dark:text-red-50/90">
                {t("auth.pendingRegisterDescription")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 border-red-300 bg-white/70 hover:bg-white dark:border-red-800 dark:bg-red-950/20"
                disabled={isSubmitting}
                onClick={() => setPendingRegister(false)}
              >
                {t("common.cancel")}
              </Button>
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
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={
                    isBootstrap || pendingRegister
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
              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting
                  ? t("auth.processing")
                  : pendingRegister && !isBootstrap
                    ? t("auth.confirmRegister")
                    : t("auth.loginRegister")}
              </Button>
            </form>

            <div className="relative text-center text-xs uppercase text-muted-foreground">
              <span className="bg-card px-2 relative z-10">{t("auth.or")}</span>
              <div className="absolute inset-x-0 top-1/2 border-t" />
            </div>
            <div className="flex flex-col gap-4">
              <Button
                onClick={() => handleLoginClick("google")}
                variant="outline"
                className="w-full"
              >
                <FontAwesomeIcon icon={faGoogle} className="w-5 h-5 mr-2" />
                {t("auth.loginWithGoogle")}
              </Button>
              <Button
                onClick={() => handleLoginClick("github")}
                variant="outline"
                className="w-full"
              >
                <FontAwesomeIcon icon={faGithub} className="w-5 h-5 mr-2" />
                {t("auth.loginWithGithub")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground">
        {t("auth.termsPrefix")}{" "}
        <a
          href={`${import.meta.env.VITE_WEBSITE_URL}/terms`}
          className="underline hover:text-neutral-700"
        >
          {t("auth.termsOfService")}
        </a>{" "}
        {t("auth.and")}{" "}
        <a
          href={`${import.meta.env.VITE_WEBSITE_URL}/privacy`}
          className="underline hover:text-neutral-700"
        >
          {t("auth.privacyPolicy")}
        </a>
        .
      </div>
    </div>
  );
}
