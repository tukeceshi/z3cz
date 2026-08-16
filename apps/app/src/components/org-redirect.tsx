import React from "react";
import { Navigate, useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { InsetLoading } from "@/components/inset-loading";
import { useRequireLoginDialog } from "@/components/login-dialog";

interface OrgRedirectProps {
  to: string;
  replace?: boolean;
}

export const OrgRedirect: React.FC<OrgRedirectProps> = ({
  to,
  replace = true,
}) => {
  const { organization, isLoading, isAuthenticated } = useAuth();
  const params = useParams();
  const waitingForLogin = useRequireLoginDialog();

  if (isLoading || waitingForLogin || !isAuthenticated) {
    return <InsetLoading />;
  }

  const orgId = params.organizationId || organization?.id;

  if (!orgId) {
    return <InsetLoading />;
  }

  let redirectTo = to.replace(":organizationId", orgId);
  for (const [key, value] of Object.entries(params)) {
    if (key !== "organizationId" && value) {
      redirectTo = redirectTo.replace(`:${key}`, value);
    }
  }

  return <Navigate to={redirectTo} replace={replace} />;
};
