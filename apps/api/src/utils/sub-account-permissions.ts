import type {
  OrganizationInfo,
  OrganizationRoleType,
  SubAccountPermissions,
} from "@dafthunk/types";
import {
  DEFAULT_SUB_ACCOUNT_PERMISSIONS,
  type WorkflowPermission,
} from "@dafthunk/types";

export function parseSubAccountPermissions(
  value: unknown
): SubAccountPermissions {
  if (!value || typeof value !== "object") {
    return DEFAULT_SUB_ACCOUNT_PERMISSIONS;
  }

  const raw = value as Record<string, unknown>;
  const workflowsRaw = raw.workflows;
  const workflows: WorkflowPermission =
    workflowsRaw === "edit" ? "edit" : "view";

  return {
    aiInterfaces: raw.aiInterfaces === true,
    subAccountsView: raw.subAccountsView === true,
    subAccountsDelete: raw.subAccountsDelete === true,
    workflows,
    executions: raw.executions !== false,
    modelCalls: raw.modelCalls !== false,
    apiKeys: raw.apiKeys === true,
  };
}

export function mergeSubAccountPermissions(
  current: SubAccountPermissions,
  patch: Partial<SubAccountPermissions>
): SubAccountPermissions {
  return {
    aiInterfaces: patch.aiInterfaces ?? current.aiInterfaces,
    subAccountsView: patch.subAccountsView ?? current.subAccountsView,
    subAccountsDelete: patch.subAccountsDelete ?? current.subAccountsDelete,
    workflows: patch.workflows ?? current.workflows,
    executions: patch.executions ?? current.executions,
    modelCalls: patch.modelCalls ?? current.modelCalls,
    apiKeys: patch.apiKeys ?? current.apiKeys,
  };
}

export function isOrganizationOwnerRole(role: OrganizationRoleType): boolean {
  return role === "owner";
}

export function hasSubAccountPermission(
  role: OrganizationRoleType,
  permissions: SubAccountPermissions | null | undefined,
  check: (permissions: SubAccountPermissions) => boolean
): boolean {
  if (isOrganizationOwnerRole(role)) {
    return true;
  }
  return check(permissions ?? DEFAULT_SUB_ACCOUNT_PERMISSIONS);
}

export function canViewWorkflows(
  role: OrganizationRoleType,
  permissions?: SubAccountPermissions | null
): boolean {
  return hasSubAccountPermission(role, permissions, () => true);
}

export function canEditWorkflows(
  role: OrganizationRoleType,
  permissions?: SubAccountPermissions | null
): boolean {
  return hasSubAccountPermission(
    role,
    permissions,
    (p) => p.workflows === "edit"
  );
}

export function canAccessAiInterfaces(
  role: OrganizationRoleType,
  permissions?: SubAccountPermissions | null
): boolean {
  return hasSubAccountPermission(role, permissions, (p) => p.aiInterfaces);
}

export function canAccessExecutions(
  role: OrganizationRoleType,
  permissions?: SubAccountPermissions | null
): boolean {
  return hasSubAccountPermission(role, permissions, (p) => p.executions);
}

export function canAccessModelCalls(
  role: OrganizationRoleType,
  permissions?: SubAccountPermissions | null
): boolean {
  return hasSubAccountPermission(role, permissions, (p) => p.modelCalls);
}

export function canAccessApiKeys(
  role: OrganizationRoleType,
  permissions?: SubAccountPermissions | null
): boolean {
  return hasSubAccountPermission(role, permissions, (p) => p.apiKeys);
}

export function canViewSubAccounts(
  role: OrganizationRoleType,
  permissions?: SubAccountPermissions | null
): boolean {
  return hasSubAccountPermission(role, permissions, (p) => p.subAccountsView);
}

export function canDeleteSubAccounts(
  role: OrganizationRoleType,
  permissions?: SubAccountPermissions | null
): boolean {
  return hasSubAccountPermission(role, permissions, (p) => p.subAccountsDelete);
}

export function normalizeOrganizationRole(
  role: string | null | undefined
): OrganizationRoleType {
  return role === "owner" ? "owner" : "member";
}

export function buildOrganizationInfo(
  org: { id: string; name: string },
  membership: { role: string; permissions?: unknown }
): OrganizationInfo {
  const role = normalizeOrganizationRole(membership.role);
  if (role === "owner") {
    return { id: org.id, name: org.name, role: "owner" };
  }

  return {
    id: org.id,
    name: org.name,
    role: "member",
    permissions: parseSubAccountPermissions(membership.permissions),
  };
}
