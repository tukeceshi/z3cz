import { Navigate } from "react-router";
import { useEffect } from "react";

import { useAuth } from "@/components/auth-context";
import { InsetLoading } from "@/components/inset-loading";
import { useTranslation } from "@/components/locale-provider";
import { getDashboardPath } from "@/utils/auth-navigation";

const MARKETING_HOME_PATH = "/m/";

export function HomeRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { siteSettings, isSiteSettingsReady } = useTranslation();

  useEffect(() => {
    if (
      !isSiteSettingsReady ||
      isLoading ||
      siteSettings.homepageMode !== "marketing" ||
      isAuthenticated
    ) {
      return;
    }

    window.location.replace(MARKETING_HOME_PATH);
  }, [
    isAuthenticated,
    isLoading,
    isSiteSettingsReady,
    siteSettings.homepageMode,
  ]);

  if (!isSiteSettingsReady || isLoading) {
    return <InsetLoading />;
  }

  if (siteSettings.homepageMode === "marketing" && !isAuthenticated) {
    return <InsetLoading />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const dashboardPath = getDashboardPath(user);
  if (!dashboardPath) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={dashboardPath} replace />;
}
