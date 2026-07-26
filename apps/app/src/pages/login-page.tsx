import { Navigate, useSearchParams } from "react-router";



import { useAuth } from "@/components/auth-context";

import { LoginForm } from "@/components/login-form";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useTranslation } from "@/components/locale-provider";

import { getDashboardPath } from "@/utils/auth-navigation";



export function LoginPage() {

  const { user, isAuthenticated, logout } = useAuth();

  const { t } = useTranslation();

  const [searchParams] = useSearchParams();

  const returnTo = searchParams.get("returnTo");

  const subAccountInvitation = searchParams.get("subAccountInvitation");



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

              <a href="/login">{t("common.cancel")}</a>

            </Button>

          </CardContent>

        </Card>

      </div>

    );

  }



  if (isAuthenticated && user && !subAccountInvitation) {

    if (returnTo) {

      return <Navigate to={returnTo} replace />;

    }



    const dashboardPath = getDashboardPath(user);

    if (dashboardPath) {

      return <Navigate to={dashboardPath} replace />;

    }

  }



  return (

    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/50 p-6 md:p-10">

      <LoginForm

        returnTo={returnTo ?? undefined}

        subAccountInvitationId={subAccountInvitation ?? undefined}

      />

    </div>

  );

}

