import { Navigate, useNavigate, useSearchParams } from "react-router";
import { useEffect, useRef } from "react";

import { useAuth } from "@/components/auth-context";
import { InsetLoading } from "@/components/inset-loading";
import { useLoginDialog } from "@/components/login-dialog";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getDashboardPath,
  isSafeAppPath,
} from "@/utils/auth-navigation";
import { scheduleConsolePrefetch } from "@/utils/console-prefetch";

export function LoginPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { t } = useTranslation();
  const { openLogin } = useLoginDialog();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const subAccountInvitation = searchParams.get("subAccountInvitation");
  const openedRef = useRef(false);

  useEffect(() => {
    scheduleConsolePrefetch();
  }, []);

  useEffect(() => {
    if (isLoading || openedRef.current) {
      return;
    }
    if (isAuthenticated && user && !subAccountInvitation) {
      return;
    }
    openedRef.current = true;
    if (returnTo && isSafeAppPath(returnTo)) {
      navigate(returnTo, { replace: true });
      openLogin({
        dismissible: false,
        goToConsole: false,
        subAccountInvitationId: subAccountInvitation ?? undefined,
      });
      return;
    }
    openLogin({
      dismissible: true,
      goToConsole: !subAccountInvitation,
      subAccountInvitationId: subAccountInvitation ?? undefined,
    });
  }, [
    isAuthenticated,
    isLoading,
    navigate,
    openLogin,
    returnTo,
    subAccountInvitation,
    user,
  ]);

  if (isLoading) {
    return <InsetLoading />;
  }

  if (isAuthenticated && user && subAccountInvitation) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-muted/50 p-6 md:p-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("auth.subAccountInviteActiveSessionTitle")}</CardTitle>
            <CardDescription>
              {t("auth.subAccountInviteActiveSessionDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => void logout()}>{t("userMenu.logout")}</Button>
            <Button variant="outline" asChild>
              <a href="/">{t("common.cancel")}</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAuthenticated && user && !subAccountInvitation) {
    if (returnTo && isSafeAppPath(returnTo)) {
      return <Navigate to={returnTo} replace />;
    }

    const dashboardPath = getDashboardPath(user);
    if (dashboardPath) {
      return <Navigate to={dashboardPath} replace />;
    }
  }

  return <div className="min-h-svh bg-neutral-100 dark:bg-neutral-900" />;
}
