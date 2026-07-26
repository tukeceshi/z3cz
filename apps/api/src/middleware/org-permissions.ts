import type {
  JWTTokenPayload,
  OrganizationRoleType,
  SubAccountPermissions,
} from "@dafthunk/types";
import type { Context, Next } from "hono";

import type { ApiContext } from "../context";
import {
  canAccessAiInterfaces,
  canAccessApiKeys,
  canAccessExecutions,
  canAccessModelCalls,
  canDeleteSubAccounts,
  canEditWorkflows,
  canViewSubAccounts,
  canViewWorkflows,
  normalizeOrganizationRole,
  parseSubAccountPermissions,
} from "../utils/sub-account-permissions";

export interface OrgMembershipContext {
  role: OrganizationRoleType;
  permissions: SubAccountPermissions;
}

export function membershipFromJwtPayload(
  payload: JWTTokenPayload | undefined
): OrgMembershipContext | null {
  if (!payload?.organization) {
    return null;
  }

  const role = normalizeOrganizationRole(payload.organization.role);
  const permissions = payload.organization.permissions
    ? parseSubAccountPermissions(payload.organization.permissions)
    : parseSubAccountPermissions(null);

  return { role, permissions };
}

export function getOrgMembershipContext(
  c: Context<ApiContext>
): OrgMembershipContext | null {
  return membershipFromJwtPayload(c.get("jwtPayload"));
}

export const WS_ORG_ROLE_HEADER = "X-Org-Role";
export const WS_ORG_PERMISSIONS_HEADER = "X-Org-Permissions";

export function applyWsMembershipHeaders(
  headers: Headers,
  payload: JWTTokenPayload
): void {
  const membership = membershipFromJwtPayload(payload);
  if (!membership) {
    return;
  }

  headers.set(WS_ORG_ROLE_HEADER, membership.role);
  headers.set(WS_ORG_PERMISSIONS_HEADER, JSON.stringify(membership.permissions));
}

export function readWsMembershipFromHeaders(
  headers: Headers
): OrgMembershipContext | null {
  const roleRaw = headers.get(WS_ORG_ROLE_HEADER);
  if (!roleRaw) {
    return null;
  }

  const role = normalizeOrganizationRole(roleRaw);
  let permissions: SubAccountPermissions;
  try {
    const raw = headers.get(WS_ORG_PERMISSIONS_HEADER);
    permissions = raw
      ? parseSubAccountPermissions(JSON.parse(raw))
      : parseSubAccountPermissions(null);
  } catch {
    permissions = parseSubAccountPermissions(null);
  }

  return { role, permissions };
}

function deny(c: Context<ApiContext>) {
  return c.json({ error: "Permission denied" }, 403);
}

/** API key auth has no JWT payload; org-scoped keys bypass sub-account permission checks. */
function isApiKeyAuthenticated(c: Context<ApiContext>): boolean {
  return !c.get("jwtPayload");
}

export function requireWorkflowView() {
  return async (c: Context<ApiContext>, next: Next) => {
    const ctx = getOrgMembershipContext(c);
    if (!ctx || !canViewWorkflows(ctx.role, ctx.permissions)) {
      return deny(c);
    }
    await next();
  };
}

export function requireWorkflowRouteAccess() {
  return async (c: Context<ApiContext>, next: Next) => {
    const ctx = getOrgMembershipContext(c);
    if (!ctx) {
      return deny(c);
    }

    const path = c.req.path;
    const isExecutionOp =
      /\/execute(\/|$)/.test(path) || /\/executions\//.test(path);

    if (isExecutionOp) {
      if (!canAccessExecutions(ctx.role, ctx.permissions)) {
        return deny(c);
      }
      await next();
      return;
    }

    const canAccess =
      c.req.method === "GET"
        ? canViewWorkflows(ctx.role, ctx.permissions)
        : canEditWorkflows(ctx.role, ctx.permissions);
    if (!canAccess) {
      return deny(c);
    }
    await next();
  };
}

export function requireAiInterfacesAccess() {
  return async (c: Context<ApiContext>, next: Next) => {
    const ctx = getOrgMembershipContext(c);
    if (!ctx || !canAccessAiInterfaces(ctx.role, ctx.permissions)) {
      return deny(c);
    }
    await next();
  };
}

export function requireExecutionsAccess() {
  return async (c: Context<ApiContext>, next: Next) => {
    if (isApiKeyAuthenticated(c)) {
      await next();
      return;
    }
    const ctx = getOrgMembershipContext(c);
    if (!ctx || !canAccessExecutions(ctx.role, ctx.permissions)) {
      return deny(c);
    }
    await next();
  };
}

export function requireModelCallsAccess() {
  return async (c: Context<ApiContext>, next: Next) => {
    const ctx = getOrgMembershipContext(c);
    if (!ctx || !canAccessModelCalls(ctx.role, ctx.permissions)) {
      return deny(c);
    }
    await next();
  };
}

export function requireApiKeysAccess() {
  return async (c: Context<ApiContext>, next: Next) => {
    const ctx = getOrgMembershipContext(c);
    if (!ctx || !canAccessApiKeys(ctx.role, ctx.permissions)) {
      return deny(c);
    }
    await next();
  };
}

export function requireSubAccountsView() {
  return async (c: Context<ApiContext>, next: Next) => {
    const ctx = getOrgMembershipContext(c);
    if (!ctx || !canViewSubAccounts(ctx.role, ctx.permissions)) {
      return deny(c);
    }
    await next();
  };
}

export function requireSubAccountsDelete() {
  return async (c: Context<ApiContext>, next: Next) => {
    const ctx = getOrgMembershipContext(c);
    if (!ctx || !canDeleteSubAccounts(ctx.role, ctx.permissions)) {
      return deny(c);
    }
    await next();
  };
}

export function requireOrganizationOwner() {
  return async (c: Context<ApiContext>, next: Next) => {
    const ctx = getOrgMembershipContext(c);
    if (!ctx || ctx.role !== "owner") {
      return deny(c);
    }
    await next();
  };
}

/** Ensures /organizations/:id/* path org matches the JWT organization (prevents cross-org IDOR). */
export function requireOrganizationPathMatch() {
  return async (c: Context<ApiContext>, next: Next) => {
    const pathOrgId = c.req.param("id");
    const jwtOrgId = c.get("jwtPayload")?.organization?.id;

    if (!pathOrgId || !jwtOrgId || pathOrgId !== jwtOrgId) {
      return c.json({ error: "Organization access denied" }, 403);
    }

    await next();
  };
}

export function requireDashboardAccess() {
  return async (c: Context<ApiContext>, next: Next) => {
    const ctx = getOrgMembershipContext(c);
    if (!ctx) {
      return deny(c);
    }

    const canAccess =
      canViewWorkflows(ctx.role, ctx.permissions) ||
      canAccessExecutions(ctx.role, ctx.permissions);

    if (!canAccess) {
      return deny(c);
    }

    await next();
  };
}
