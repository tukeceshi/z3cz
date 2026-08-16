import { Navigate } from "react-router";

import { useAuth } from "@/components/auth-context";
import { InsetLoading } from "@/components/inset-loading";
import { useRequireLoginDialog } from "@/components/login-dialog";

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();
  const waitingForLogin = useRequireLoginDialog();

  if (waitingForLogin || !isAuthenticated) {
    return <InsetLoading />;
  }

  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
