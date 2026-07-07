import { Navigate, useSearchParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { LoginForm } from "@/components/login-form";
import { getDashboardPath } from "@/utils/auth-navigation";

export function LoginPage() {
  const { user, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  if (isAuthenticated && user) {
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
      <LoginForm returnTo={returnTo ?? undefined} />
    </div>
  );
}
