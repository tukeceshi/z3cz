import type { ResourceFeatureId } from "@dafthunk/types";
import type { ReactNode } from "react";
import { Navigate, useParams } from "react-router";

import { useIsFeatureEnabled } from "@/hooks/use-feature-config";

interface FeatureRouteGuardProps {
  feature: ResourceFeatureId;
  children: ReactNode;
}

export function FeatureRouteGuard({
  feature,
  children,
}: FeatureRouteGuardProps) {
  const { organizationId } = useParams<{ organizationId: string }>();
  const enabled = useIsFeatureEnabled(feature);

  if (!enabled) {
    return (
      <Navigate
        to={organizationId ? `/org/${organizationId}/dashboard` : "/"}
        replace
      />
    );
  }

  return children;
}
