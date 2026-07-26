import CronParser from "cron-parser";

import type { Bindings } from "./context";
import {
  createDatabase,
  getActiveScheduledTriggers,
  resolveOrganizationBillingOptions,
} from "./db";
import { WorkflowStore } from "./stores/workflow-store";
import { creditChecksEnabled } from "./utils/credits";

export async function handleScheduledEvent(
  _event: ScheduledEvent,
  env: Bindings,
  _ctx: ExecutionContext
): Promise<void> {
  console.log("Scheduled event triggered at:", new Date().toISOString());

  const db = createDatabase(env);
  const workflowStore = new WorkflowStore(env);

  const triggers = await getActiveScheduledTriggers(
    db,
    creditChecksEnabled(env.CLOUDFLARE_ENV)
  );
  console.log(`Found ${triggers.length} active scheduled triggers`);

  const now = Date.now();

  for (const { scheduledTrigger, workflow, organizationBilling } of triggers) {
    try {
      // Parse schedule expression
      const interval = CronParser.parse(scheduledTrigger.scheduleExpression, {
        currentDate: new Date(now),
        tz: "UTC",
      });

      const scheduledTime = interval.prev().toDate();

      // Check if should run now (within last minute since we run every minute)
      if (Math.abs(now - scheduledTime.getTime()) > 60000) {
        continue; // Not time to execute
      }

      console.log(
        `Executing scheduled workflow ${workflow.id} (${scheduledTrigger.scheduleExpression})`
      );

      // Load workflow data from working version
      const workflowWithData = await workflowStore.getWithData(
        workflow.id,
        workflow.organizationId
      );
      if (!workflowWithData?.data) {
        console.error(`Failed to load workflow data for ${workflow.id}`);
        continue;
      }
      const workflowData = workflowWithData.data;

      const billingOptions = resolveOrganizationBillingOptions(
        organizationBilling,
        env.CLOUDFLARE_ENV
      );

      const executionParams = {
        userId: "scheduled_trigger",
        organizationId: workflow.organizationId,
        ...billingOptions,
        workflow: {
          id: workflow.id,
          name: workflow.name,
          trigger: workflowData.trigger,
          runtime: workflowData.runtime,
          nodes: workflowData.nodes,
          edges: workflowData.edges,
        },
        scheduledTrigger: {
          timestamp: now,
          scheduledTime: scheduledTime.getTime(),
          scheduleExpression: scheduledTrigger.scheduleExpression,
        },
      };

      const { startWorkflowExecution } = await import(
        "./runtime/start-workflow-execution"
      );
      const result = await startWorkflowExecution(env, executionParams);
      console.log(
        `[Execution] ${result.executionId} workflow=${workflow.id} runtime=${workflowData.runtime} trigger=scheduled` +
          (result.status ? ` status=${result.status}` : "")
      );
    } catch (error) {
      console.error(
        `Error executing scheduled workflow ${workflow.id}:`,
        error
      );
    }
  }

  try {
    const { runCloudStorageMaintenanceCron } = await import(
      "./services/cloud-storage-maintenance-cron"
    );
    await runCloudStorageMaintenanceCron(env);
  } catch (error) {
    console.error("[cloud-storage-cron] Maintenance run failed:", error);
  }
}
