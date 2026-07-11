import type { ResourceFeatureId } from "@dafthunk/types";
import type { ReactNode } from "react";

import { FeatureRouteGuard } from "@/components/feature-route-guard";
import { OrgLayout } from "@/components/org-layout";
import { ProtectedRoute } from "@/components/protected-route";

interface OrgFeatureRouteProps {
  feature: ResourceFeatureId;
  title: string;
  children: ReactNode;
}

export function OrgFeatureRoute({
  feature,
  title,
  children,
}: OrgFeatureRouteProps) {
  return (
    <OrgLayout title={title}>
      <ProtectedRoute>
        <FeatureRouteGuard feature={feature}>{children}</FeatureRouteGuard>
      </ProtectedRoute>
    </OrgLayout>
  );
}
