import {
  DashboardRecentWorkflow,
  DashboardStats,
  DashboardStatsResponse,
} from "@dafthunk/types";
import { Hono } from "hono";

import { jwtMiddleware } from "../auth";
import { ApiContext } from "../context";
import { requireDashboardAccess } from "../middleware/org-permissions";
import { WorkflowStore } from "../stores/workflow-store";

const RECENT_WORKFLOW_LIMIT = 8;

const dashboard = new Hono<ApiContext>();

dashboard.use("*", jwtMiddleware);
dashboard.use("*", requireDashboardAccess());

/**
 * GET /:organizationId/dashboard
 *
 * Recent workflows for the organization dashboard home page.
 */
dashboard.get("/", async (c) => {
  const organizationId = c.get("organizationId")!;

  const workflowStore = new WorkflowStore(c.env);

  try {
    const workflows = await workflowStore.list(organizationId);
    const recentWorkflows: DashboardRecentWorkflow[] = workflows
      .slice(0, RECENT_WORKFLOW_LIMIT)
      .map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        coverObjectId: workflow.coverObjectId,
        coverMimeType: workflow.coverMimeType,
        updatedAt: workflow.updatedAt,
      }));

    const stats: DashboardStats = {
      recentWorkflows,
    };

    const response: DashboardStatsResponse = { stats };
    return c.json(response);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return c.json({ error: "Failed to fetch dashboard statistics" }, 500);
  }
});

export default dashboard;
