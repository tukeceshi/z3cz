import type {
  CreateSubAccountInvitationRequest,
  CreateSubAccountInvitationResponse,
  DeleteInvitationResponse,
  ListInvitationsResponse,
  ListMembershipsResponse,
  ListOrganizationsResponse,
  RemoveMembershipRequest,
  RemoveMembershipResponse,
  UpdateMembershipPermissionsRequest,
  UpdateMembershipPermissionsResponse,
  UpdateOrganizationRequest,
  UpdateOrganizationResponse,
} from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { jwtMiddleware } from "../auth";
import { ApiContext } from "../context";
import { createDatabase } from "../db";
import {
  createInvitation,
  deleteInvitation,
  deleteMembership,
  getOrganization,
  getOrganizationInvitations,
  getOrganizationMembershipsWithUsers,
  getUserOrganizations,
  updateMembershipPermissions,
  updateOrganizationName,
} from "../db/queries";
import { requireOrganizationOwner, requireOrganizationPathMatch } from "../middleware/org-permissions";
import { createEmailService } from "../services/email-service";
import { getSubAccountInvitationEmail } from "../services/email-templates";
import {
  parseSubAccountPermissions,
  normalizeOrganizationRole,
} from "../utils/sub-account-permissions";

const subAccountPermissionsSchema = z.object({
  aiInterfaces: z.boolean().optional(),
  subAccountsView: z.boolean().optional(),
  subAccountsDelete: z.boolean().optional(),
  workflows: z.enum(["view", "edit"]).optional(),
  executions: z.boolean().optional(),
  modelCalls: z.boolean().optional(),
  apiKeys: z.boolean().optional(),
});

const organizationRoutes = new Hono<ApiContext>();

organizationRoutes.use("*", jwtMiddleware);

organizationRoutes.use("/:id", requireOrganizationPathMatch());
organizationRoutes.use("/:id/*", requireOrganizationPathMatch());

organizationRoutes.get("/", async (c) => {
  const jwtPayload = c.get("jwtPayload");
  if (!jwtPayload) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = createDatabase(c.env);
  const organizations = await getUserOrganizations(db, jwtPayload.sub);
  const response: ListOrganizationsResponse = {
    organizations: organizations.map((org) => ({
      ...org,
      role: normalizeOrganizationRole(org.role),
    })),
  };
  return c.json(response);
});

organizationRoutes.post("/", async (c) => {
  return c.json({ error: "Creating additional organizations is not allowed" }, 403);
});

organizationRoutes.patch(
  "/:id",
  requireOrganizationOwner(),
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(64),
    }) as z.ZodType<UpdateOrganizationRequest>
  ),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const db = createDatabase(c.env);
    const organizationId = c.req.param("id");
    const { name } = c.req.valid("json");

    const organization = await updateOrganizationName(
      db,
      organizationId,
      jwtPayload.sub,
      name.trim()
    );

    if (!organization) {
      return c.json({ error: "Organization not found or permission denied" }, 404);
    }

    const response: UpdateOrganizationResponse = { organization };
    return c.json(response);
  }
);

organizationRoutes.delete("/:id", async (c) => {
  return c.json({ error: "Organizations cannot be deleted" }, 403);
});

organizationRoutes.get("/:id/memberships", requireOrganizationOwner(), async (c) => {
  const db = createDatabase(c.env);
  const organizationId = c.req.param("id");
  const memberships = await getOrganizationMembershipsWithUsers(db, organizationId);

  const response: ListMembershipsResponse = {
    memberships: memberships.map((m) => ({
      ...m,
      role: normalizeOrganizationRole(m.role),
      permissions:
        normalizeOrganizationRole(m.role) === "owner"
          ? null
          : parseSubAccountPermissions(m.permissions),
    })),
  };
  return c.json(response);
});

organizationRoutes.patch(
  "/:id/memberships/permissions",
  requireOrganizationOwner(),
  zValidator(
    "json",
    z.object({
      email: z.string().email(),
      permissions: subAccountPermissionsSchema,
    }) as z.ZodType<Omit<UpdateMembershipPermissionsRequest, "organizationId">>
  ),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const db = createDatabase(c.env);
    const organizationId = c.req.param("id");
    const { email, permissions } = c.req.valid("json");

    const membership = await updateMembershipPermissions(
      db,
      organizationId,
      email,
      permissions,
      jwtPayload.sub
    );

    if (!membership) {
      return c.json({ error: "Permission denied or member not found" }, 403);
    }

    const response: UpdateMembershipPermissionsResponse = {
      membership: {
        userId: membership.userId,
        organizationId: membership.organizationId,
        role: normalizeOrganizationRole(membership.role),
        permissions: parseSubAccountPermissions(membership.permissions),
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
      },
    };
    return c.json(response);
  }
);

organizationRoutes.delete(
  "/:id/memberships",
  requireOrganizationOwner(),
  zValidator(
    "json",
    z.object({ email: z.string().email() }) as z.ZodType<
      Omit<RemoveMembershipRequest, "organizationId">
    >
  ),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const db = createDatabase(c.env);
    const organizationId = c.req.param("id");
    const { email } = c.req.valid("json");

    const success = await deleteMembership(
      db,
      organizationId,
      email,
      jwtPayload.sub
    );

    if (!success) {
      return c.json({ error: "Permission denied or member not found" }, 403);
    }

    const response: RemoveMembershipResponse = { success: true };
    return c.json(response);
  }
);

organizationRoutes.get("/:id/invitations", requireOrganizationOwner(), async (c) => {
  const db = createDatabase(c.env);
  const organizationId = c.req.param("id");
  const invitations = await getOrganizationInvitations(db, organizationId);

  const response: ListInvitationsResponse = {
    invitations: invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      organizationId: inv.organizationId,
      permissions: parseSubAccountPermissions(inv.permissions),
      status: inv.status as "pending" | "accepted" | "declined" | "expired",
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
      inviter: inv.inviter,
    })),
  };
  return c.json(response);
});

organizationRoutes.post(
  "/:id/invitations",
  requireOrganizationOwner(),
  zValidator(
    "json",
    z.object({
      email: z.string().email(),
      permissions: subAccountPermissionsSchema.optional(),
    }) as z.ZodType<CreateSubAccountInvitationRequest>
  ),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const db = createDatabase(c.env);
    const organizationId = c.req.param("id");
    const { email, permissions } = c.req.valid("json");

    const invitation = await createInvitation(
      db,
      organizationId,
      email,
      permissions,
      jwtPayload.sub
    );

    if (!invitation) {
      return c.json(
        {
          error:
            "Permission denied, email already registered, or pending invitation exists",
        },
        403
      );
    }

    const allInvitations = await getOrganizationInvitations(db, organizationId);
    const createdInvitation = allInvitations.find((inv) => inv.id === invitation.id);

    if (!createdInvitation) {
      return c.json({ error: "Failed to retrieve created invitation" }, 500);
    }

    const emailService = createEmailService(c.env);
    const organization = await getOrganization(db, organizationId);
    if (emailService && organization) {
      const emailContent = getSubAccountInvitationEmail({
        organizationName: organization.name,
        inviterName: createdInvitation.inviter.name,
        invitationId: invitation.id,
        expiresAt: invitation.expiresAt,
        appUrl: c.env.WEB_HOST,
        websiteUrl: c.env.WEBSITE_URL,
      });

      const emailResult = await emailService.send({
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      if (!emailResult.success) {
        console.warn("Failed to send sub-account invitation email:", emailResult.error);
      }
    }

    const response: CreateSubAccountInvitationResponse = {
      invitation: {
        id: createdInvitation.id,
        email: createdInvitation.email,
        organizationId: createdInvitation.organizationId,
        permissions: parseSubAccountPermissions(createdInvitation.permissions),
        status: createdInvitation.status as "pending",
        expiresAt: createdInvitation.expiresAt,
        createdAt: createdInvitation.createdAt,
        updatedAt: createdInvitation.updatedAt,
        inviter: createdInvitation.inviter,
      },
    };
    return c.json(response, 201);
  }
);

organizationRoutes.delete(
  "/:id/invitations/:invitationId",
  requireOrganizationOwner(),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const db = createDatabase(c.env);
    const organizationId = c.req.param("id");
    const invitationId = c.req.param("invitationId");

    const success = await deleteInvitation(
      db,
      invitationId,
      organizationId,
      jwtPayload.sub
    );

    if (!success) {
      return c.json({ error: "Permission denied or invitation not found" }, 403);
    }

    const response: DeleteInvitationResponse = { success: true };
    return c.json(response);
  }
);

export default organizationRoutes;
