import { useEffect, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { Toaster } from "sonner";

import { useAuth } from "@/components/auth-context";
import { InsetLoading } from "@/components/inset-loading";
import { useRequireLoginDialog } from "@/components/login-dialog";

interface CanvasLayoutProps {
  readonly children: ReactNode;
}

export function CanvasLayout({ children }: CanvasLayoutProps) {
  const params = useParams<{ organizationId: string }>();
  const navigate = useNavigate();
  const { organization, isAuthenticated, isLoading } = useAuth();
  const waitingForLogin = useRequireLoginDialog();

  useEffect(() => {
    if (
      params.organizationId &&
      organization?.id &&
      params.organizationId !== organization.id
    ) {
      navigate(`/org/${organization.id}/dashboard`, { replace: true });
    }
  }, [navigate, organization?.id, params.organizationId]);

  if (isLoading || !isAuthenticated || waitingForLogin || !organization?.id) {
    return (
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
        <InsetLoading />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <Toaster />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
