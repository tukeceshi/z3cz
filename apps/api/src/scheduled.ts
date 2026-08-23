import CronParser from "cron-parser";

import type { Bindings } from "./context";
import {
  createDatabase,
  getActiveScheduledTriggers,
} from "./db";
import { creditChecksEnabled } from "./utils/credits";

export async function handleScheduledEvent(
  _event: ScheduledEvent,
  env: Bindings,
  _ctx: ExecutionContext
): Promise<void> {
  console.log("Scheduled event triggered at:", new Date().toISOString());

  const db = createDatabase(env);

  const triggers = await getActiveScheduledTriggers(
    db,
    creditChecksEnabled(env.CLOUDFLARE_ENV)
  );
  console.log(`Found ${triggers.length} active scheduled triggers`);

  const now = Date.now();

  for (const { scheduledTrigger, workflow } of triggers) {
    try {
      const interval = CronParser.parse(scheduledTrigger.scheduleExpression, {
        currentDate: new Date(now),
        tz: "UTC",
      });

      const scheduledTime = interval.prev().toDate();

      if (Math.abs(now - scheduledTime.getTime()) > 60000) {
        continue;
      }

      console.log(
        `Skipping scheduled workflow ${workflow.id}: full workflow execution is disabled`
      );
    } catch (error) {
      console.error(
        `Error processing scheduled workflow ${workflow.id}:`,
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
