import type { OrganizationInfo, SubAccountPermissions } from "@dafthunk/types";
import { DEFAULT_SUB_ACCOUNT_PERMISSIONS } from "@dafthunk/types";

export function isOrganizationOwner(
  organization: OrganizationInfo | null | undefined
): boolean {
  return organization?.role === "owner";
}

export function getEffectivePermissions(
  organization: OrganizationInfo | null | undefined
): SubAccountPermissions {
  if (!organization || organization.role === "owner") {
    return {
      aiInterfaces: true,
      subAccountsView: true,
      subAccountsDelete: true,
      workflows: "edit",
      executions: true,
      modelCalls: true,
      apiKeys: true,
    };
  }

  return organization.permissions ?? DEFAULT_SUB_ACCOUNT_PERMISSIONS;
}

export function canEditWorkflows(
  organization: OrganizationInfo | null | undefined
): boolean {
  return getEffectivePermissions(organization).workflows === "edit";
}

export function canViewWorkflows(
  organization: OrganizationInfo | null | undefined
): boolean {
  if (!organization) {
    return false;
  }
  return organization.role === "owner" || getEffectivePermissions(organization).workflows !== undefined;
}

export function canAccessExecutions(
  organization: OrganizationInfo | null | undefined
): boolean {
  return getEffectivePermissions(organization).executions;
}

export function canAccessModelCalls(
  organization: OrganizationInfo | null | undefined
): boolean {
  return getEffectivePermissions(organization).modelCalls;
}

export function canAccessAiInterfaces(
  organization: OrganizationInfo | null | undefined
): boolean {
  return getEffectivePermissions(organization).aiInterfaces;
}

export function canAccessApiKeys(
  organization: OrganizationInfo | null | undefined
): boolean {
  return getEffectivePermissions(organization).apiKeys;
}

export function canManageSubAccounts(
  organization: OrganizationInfo | null | undefined
): boolean {
  return isOrganizationOwner(organization);
}

export function canAccessBilling(
  organization: OrganizationInfo | null | undefined
): boolean {
  return isOrganizationOwner(organization);
}
