import { Navigate } from "react-router";

import { useAuth } from "@/components/auth-context";
import { InsetLoading } from "@/components/inset-loading";
import { getDashboardPath } from "@/utils/auth-navigation";

export function HomeRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
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
