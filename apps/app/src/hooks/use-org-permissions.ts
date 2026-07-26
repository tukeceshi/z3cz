import { useMemo } from "react";

import { useAuth } from "@/components/auth-context";
import {
  canAccessAiInterfaces,
  canAccessApiKeys,
  canAccessBilling,
  canAccessExecutions,
  canAccessModelCalls,
  canEditWorkflows,
  canManageSubAccounts,
  canViewWorkflows,
  isOrganizationOwner,
} from "@/utils/sub-account-permissions";

export function useOrgPermissions() {
  const { organization } = useAuth();

  return useMemo(
    () => ({
      organization,
      isOwner: isOrganizationOwner(organization),
      canViewWorkflows: canViewWorkflows(organization),
      canEditWorkflows: canEditWorkflows(organization),
      canAccessExecutions: canAccessExecutions(organization),
      canAccessModelCalls: canAccessModelCalls(organization),
      canAccessAiInterfaces: canAccessAiInterfaces(organization),
      canAccessApiKeys: canAccessApiKeys(organization),
      canManageSubAccounts: canManageSubAccounts(organization),
      canAccessBilling: canAccessBilling(organization),
      canManageResources: isOrganizationOwner(organization),
    }),
    [organization]
  );
}
