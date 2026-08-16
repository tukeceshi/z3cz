import { useAuth } from "@/components/auth-context";
import { InsetLoading } from "@/components/inset-loading";
import { useRequireLoginDialog } from "@/components/login-dialog";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth();
  const waitingForLogin = useRequireLoginDialog();

  if (waitingForLogin || !isAuthenticated) {
    return <InsetLoading />;
  }

  return <>{children}</>;
}
