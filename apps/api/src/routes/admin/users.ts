import type { GetBillingResponse } from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { and, count, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { PRO_INCLUDED_CREDITS, TRIAL_CREDITS } from "../../constants/billing";
import { ApiContext } from "../../context";
import {
  createDatabase,
  memberships,
  organizations,
  resolveOrganizationPlan,
  users,
  workflows,
} from "../../db";
import { sendWelcomeEmail } from "../../services/welcome-email";
import { fetchAdminOrganizationExecutionCount } from "../../utils/admin-execution-count";
import { getOrganizationComputeUsage } from "../../utils/credits";

type OnboardingStage =
  | "signed_up"
  | "tour_completed"
  | "workflow_created"
  | "workflow_executed"
  | "workflow_executed_ok";

function deriveFurthestStage(stamps: {
  tourCompleted: Date | null;
  workflowCreated: Date | null;
  workflowExecuted: Date | null;
  workflowExecutedOk: Date | null;
}): OnboardingStage {
  if (stamps.workflowExecutedOk) return "workflow_executed_ok";
  if (stamps.workflowExecuted) return "workflow_executed";
  if (stamps.workflowCreated) return "workflow_created";
  if (stamps.tourCompleted) return "tour_completed";
  return "signed_up";
}

const ownerMembershipJoin = and(
  eq(memberships.userId, users.id),
  eq(memberships.organizationId, users.organizationId),
  eq(memberships.role, "owner")
);

const adminUsersRoutes = new Hono<ApiContext>();

async function resolveMatchingOrganizationIds(
  db: ReturnType<typeof createDatabase>,
  search: string
): Promise<string[]> {
  const pattern = `%${search}%`;
  const rows = await db
    .selectDistinct({ organizationId: users.organizationId })
    .from(users)
    .where(or(like(users.name, pattern), like(users.email, pattern)));

  return rows.map((row) => row.organizationId);
}

/**
 * GET /admin/users
 *
 * List primary (owner) accounts. Search may match sub-accounts but returns
 * their owning primary account.
 */
adminUsersRoutes.get(
  "/",
  zValidator(
    "query",
    z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
      search: z.string().optional(),
    })
  ),
  async (c) => {
    const db = createDatabase(c.env);
    const { page, limit, search } = c.req.valid("query");
    const offset = (page - 1) * limit;

    try {
      const trimmedSearch = search?.trim();
      const matchingOrgIds = trimmedSearch
        ? await resolveMatchingOrganizationIds(db, trimmedSearch)
        : null;

      if (trimmedSearch && matchingOrgIds && matchingOrgIds.length === 0) {
        return c.json({
          users: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        });
      }

      const ownerFilter = matchingOrgIds
        ? inArray(users.organizationId, matchingOrgIds)
        : undefined;

      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(users)
        .innerJoin(memberships, ownerMembershipJoin)
        .where(ownerFilter);

      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
          subscriptionStatus: organizations.subscriptionStatus,
          currentPeriodEnd: organizations.currentPeriodEnd,
          role: users.role,
          developerMode: users.developerMode,
          tourCompleted: users.tourCompleted,
          workflowCreated: users.workflowCreated,
          workflowExecuted: users.workflowExecuted,
          workflowExecutedOk: users.workflowExecutedOk,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .innerJoin(memberships, ownerMembershipJoin)
        .innerJoin(organizations, eq(users.organizationId, organizations.id))
        .where(ownerFilter)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      const usersList = rows.map(
        ({ subscriptionStatus, currentPeriodEnd, ...user }) => ({
          ...user,
          plan: resolveOrganizationPlan({
            subscriptionStatus,
            currentPeriodEnd,
          }),
          furthestStage: deriveFurthestStage(user),
        })
      );

      return c.json({
        users: usersList,
        pagination: {
          page,
          limit,
          total: countResult?.count ?? 0,
          totalPages: Math.ceil((countResult?.count ?? 0) / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching admin users:", error);
      return c.json({ error: "Failed to fetch users" }, 500);
    }
  }
);

/**
 * GET /admin/users/:id
 *
 * User detail with organization billing context and sub-accounts.
 */
adminUsersRoutes.get("/:id", async (c) => {
  const db = createDatabase(c.env);
  const userId = c.req.param("id");

  try {
    const [row] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        githubId: users.githubId,
        googleId: users.googleId,
        organizationId: users.organizationId,
        subscriptionStatus: organizations.subscriptionStatus,
        currentPeriodEnd: organizations.currentPeriodEnd,
        role: users.role,
        developerMode: users.developerMode,
        tourCompleted: users.tourCompleted,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .innerJoin(organizations, eq(users.organizationId, organizations.id))
      .where(eq(users.id, userId));

    if (!row) {
      return c.json({ error: "User not found" }, 404);
    }

    const { subscriptionStatus, currentPeriodEnd, organizationId, ...userFields } =
      row;
    const user = {
      ...userFields,
      organizationId,
      plan: resolveOrganizationPlan({ subscriptionStatus, currentPeriodEnd }),
    };

    const [membership] = await db
      .select({ role: memberships.role })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.organizationId, organizationId)
        )
      )
      .limit(1);

    const membershipRole = membership?.role ?? "owner";

    const [organization] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        computeCredits: organizations.computeCredits,
        stripeCustomerId: organizations.stripeCustomerId,
        stripeSubscriptionId: organizations.stripeSubscriptionId,
        subscriptionStatus: organizations.subscriptionStatus,
        currentPeriodStart: organizations.currentPeriodStart,
        currentPeriodEnd: organizations.currentPeriodEnd,
        overageLimit: organizations.overageLimit,
        creditsExhausted: organizations.creditsExhausted,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId));

    const subAccounts = await db
      .select({
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        userAvatarUrl: users.avatarUrl,
        role: memberships.role,
        joinedAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.organizationId, organizationId),
          eq(memberships.role, "member")
        )
      );

    let ownerUser: {
      id: string;
      name: string;
      email: string | null;
    } | null = null;

    if (membershipRole === "member") {
      const [owner] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .innerJoin(memberships, ownerMembershipJoin)
        .where(eq(users.organizationId, organizationId))
        .limit(1);
      ownerUser = owner ?? null;
    }

    const [workflowCountResult] = await db
      .select({ count: count() })
      .from(workflows)
      .where(eq(workflows.organizationId, organizationId));

    const executionCount = await fetchAdminOrganizationExecutionCount(
      c.env,
      organizationId
    );

    return c.json({
      user,
      membershipRole,
      organization: organization ?? null,
      subAccounts,
      ownerUser,
      entityCounts: {
        workflowCount: workflowCountResult?.count ?? 0,
        executionCount,
      },
    });
  } catch (error) {
    console.error("Error fetching admin user detail:", error);
    return c.json({ error: "Failed to fetch user" }, 500);
  }
});

adminUsersRoutes.get("/:id/billing", async (c) => {
  const db = createDatabase(c.env);
  const userId = c.req.param("id");

  const [user] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, user.organizationId))
    .limit(1);

  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const usageThisPeriod = await getOrganizationComputeUsage(
    c.env.KV,
    user.organizationId
  );

  const plan = resolveOrganizationPlan(org);
  const includedCredits = plan === "pro" ? PRO_INCLUDED_CREDITS : TRIAL_CREDITS;

  const response: GetBillingResponse = {
    billing: {
      plan: plan as "trial" | "pro",
      subscriptionStatus: org.subscriptionStatus ?? undefined,
      currentPeriodStart: org.currentPeriodStart ?? undefined,
      currentPeriodEnd: org.currentPeriodEnd ?? undefined,
      usageThisPeriod,
      includedCredits,
      overageLimit: org.overageLimit ?? null,
    },
  };

  return c.json(response);
});

adminUsersRoutes.post("/:id/welcome-email", async (c) => {
  const db = createDatabase(c.env);
  const userId = c.req.param("id");

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      organizationId: users.organizationId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }
  if (!user.email) {
    return c.json({ error: "User has no email on file" }, 400);
  }

  const result = await sendWelcomeEmail(db, c.env, c.executionCtx, {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: user.organizationId,
  });

  if (!result.ok) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json({ ok: true });
});

export default adminUsersRoutes;
