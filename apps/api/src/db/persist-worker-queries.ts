import type {
  BootstrapPersistWorkerRequest,
  CreatePersistWorkerRequest,
  PersistWorker,
  PersistWorkerDeployStatus,
  PersistWorkerPoolSettings,
  UpdatePersistWorkerRequest,
} from "@dafthunk/types";
import { and, asc, eq, sql } from "drizzle-orm";

import { hashPassword, verifyPassword } from "../auth/password";
import type { Database } from "./index";
import { persistWorkers, platformSettings, PLATFORM_SETTINGS_ID } from "./schema";

function rowToPersistWorker(
  row: typeof persistWorkers.$inferSelect
): PersistWorker {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    maxConcurrentJobs: row.maxConcurrentJobs,
    activeJobCount: row.activeJobCount,
    host: row.host,
    sshPort: row.sshPort,
    sshUsername: row.sshUsername,
    deployStatus: row.deployStatus as PersistWorkerDeployStatus,
    deployError: row.deployError,
    lastDeployAt: row.lastDeployAt?.toISOString() ?? null,
    initializedAt: row.initializedAt?.toISOString() ?? null,
    lastHeartbeatAt: row.lastHeartbeatAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

export async function getPersistWorkerPoolSettings(
  db: Database
): Promise<PersistWorkerPoolSettings> {
  const [row] = await db
    .select({ enabled: platformSettings.persistWorkerPoolEnabled })
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .limit(1);

  return { enabled: row?.enabled ?? false };
}

export async function updatePersistWorkerPoolSettings(
  db: Database,
  enabled: boolean,
  updatedBy: string
): Promise<PersistWorkerPoolSettings> {
  const [existing] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .limit(1);

  if (existing) {
    await db
      .update(platformSettings)
      .set({
        persistWorkerPoolEnabled: enabled,
        updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID));
  } else {
    await db.insert(platformSettings).values({
      id: PLATFORM_SETTINGS_ID,
      persistWorkerPoolEnabled: enabled,
      updatedBy,
    });
  }

  return { enabled };
}

export async function listPersistWorkers(db: Database): Promise<PersistWorker[]> {
  const rows = await db
    .select()
    .from(persistWorkers)
    .orderBy(asc(persistWorkers.name));

  return rows.map(rowToPersistWorker);
}

export async function getPersistWorkerById(
  db: Database,
  id: string
): Promise<PersistWorker | undefined> {
  const [row] = await db
    .select()
    .from(persistWorkers)
    .where(eq(persistWorkers.id, id))
    .limit(1);

  return row ? rowToPersistWorker(row) : undefined;
}

export async function getPersistWorkerRowById(
  db: Database,
  id: string
): Promise<typeof persistWorkers.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(persistWorkers)
    .where(eq(persistWorkers.id, id))
    .limit(1);

  return row;
}

export async function hasEnabledPersistWorkers(db: Database): Promise<boolean> {
  const [row] = await db
    .select({ id: persistWorkers.id })
    .from(persistWorkers)
    .where(eq(persistWorkers.enabled, true))
    .limit(1);

  return Boolean(row);
}

export async function verifyPersistWorkerSecret(
  db: Database,
  workerId: string,
  secret: string
): Promise<typeof persistWorkers.$inferSelect | null> {
  const row = await getPersistWorkerRowById(db, workerId);
  if (!row || !row.enabled) {
    return null;
  }

  const valid = await verifyPassword(secret, row.secretHash);
  return valid ? row : null;
}

export async function createPersistWorker(
  db: Database,
  input: CreatePersistWorkerRequest & {
    readonly id: string;
    readonly secretHash: string;
    readonly host?: string | null;
    readonly sshPort?: number;
    readonly sshUsername?: string | null;
    readonly deployStatus?: PersistWorkerDeployStatus;
    readonly deployError?: string | null;
    readonly lastDeployAt?: Date | null;
    readonly initializedAt?: Date | null;
  },
  updatedBy: string
): Promise<PersistWorker> {
  const now = new Date();
  const [row] = await db
    .insert(persistWorkers)
    .values({
      id: input.id,
      name: input.name,
      enabled: input.enabled ?? true,
      secretHash: input.secretHash,
      maxConcurrentJobs: input.maxConcurrentJobs ?? 1,
      host: input.host ?? null,
      sshPort: input.sshPort ?? 22,
      sshUsername: input.sshUsername ?? null,
      deployStatus: input.deployStatus ?? "manual",
      deployError: input.deployError ?? null,
      lastDeployAt: input.lastDeployAt ?? null,
      initializedAt: input.initializedAt ?? null,
      updatedBy,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return rowToPersistWorker(row);
}

export async function updatePersistWorkerDeployState(
  db: Database,
  id: string,
  input: {
    readonly deployStatus: PersistWorkerDeployStatus;
    readonly deployError?: string | null;
    readonly lastDeployAt?: Date | null;
    readonly initializedAt?: Date | null;
    readonly secretHash?: string;
  }
): Promise<PersistWorker> {
  const [row] = await db
    .update(persistWorkers)
    .set({
      deployStatus: input.deployStatus,
      ...(input.deployError !== undefined ? { deployError: input.deployError } : {}),
      ...(input.lastDeployAt !== undefined ? { lastDeployAt: input.lastDeployAt } : {}),
      ...(input.initializedAt !== undefined
        ? { initializedAt: input.initializedAt }
        : {}),
      ...(input.secretHash !== undefined ? { secretHash: input.secretHash } : {}),
      updatedAt: new Date(),
    })
    .where(eq(persistWorkers.id, id))
    .returning();

  if (!row) {
    throw new Error("Persist worker not found");
  }

  return rowToPersistWorker(row);
}

export function slugPersistWorkerId(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug.length >= 2 ? slug : "worker";
}

export function buildBootstrapPersistWorkerInput(
  input: BootstrapPersistWorkerRequest
): {
  readonly id: string;
  readonly host: string;
  readonly sshPort: number;
} {
  const host = input.host.trim();
  const id = slugPersistWorkerId(input.id ?? host);
  return {
    id,
    host,
    sshPort: input.sshPort ?? 22,
  };
}

export async function updatePersistWorker(
  db: Database,
  id: string,
  input: UpdatePersistWorkerRequest & { readonly secretHash?: string },
  updatedBy: string
): Promise<PersistWorker> {
  const [row] = await db
    .update(persistWorkers)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.maxConcurrentJobs !== undefined
        ? { maxConcurrentJobs: input.maxConcurrentJobs }
        : {}),
      ...(input.secretHash !== undefined ? { secretHash: input.secretHash } : {}),
      updatedBy,
      updatedAt: new Date(),
    })
    .where(eq(persistWorkers.id, id))
    .returning();

  if (!row) {
    throw new Error("Persist worker not found");
  }

  return rowToPersistWorker(row);
}

export async function deletePersistWorker(
  db: Database,
  id: string
): Promise<void> {
  const result = await db
    .delete(persistWorkers)
    .where(eq(persistWorkers.id, id))
    .returning({ id: persistWorkers.id });

  if (result.length === 0) {
    throw new Error("Persist worker not found");
  }
}

export async function touchPersistWorkerHeartbeat(
  db: Database,
  workerId: string
): Promise<void> {
  await db
    .update(persistWorkers)
    .set({
      lastHeartbeatAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(persistWorkers.id, workerId));
}

export async function incrementPersistWorkerActiveJobs(
  db: Database,
  workerId: string
): Promise<boolean> {
  const result = await db
    .update(persistWorkers)
    .set({
      activeJobCount: sql`${persistWorkers.activeJobCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(persistWorkers.id, workerId),
        eq(persistWorkers.enabled, true),
        sql`${persistWorkers.activeJobCount} < ${persistWorkers.maxConcurrentJobs}`
      )
    )
    .returning({ id: persistWorkers.id });

  return result.length > 0;
}

export async function decrementPersistWorkerActiveJobs(
  db: Database,
  workerId: string
): Promise<void> {
  await db
    .update(persistWorkers)
    .set({
      activeJobCount: sql`GREATEST(0, ${persistWorkers.activeJobCount} - 1)`,
      updatedAt: new Date(),
    })
    .where(eq(persistWorkers.id, workerId));
}

export function generatePersistWorkerSecret(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export async function hashPersistWorkerSecret(secret: string): Promise<string> {
  return hashPassword(secret);
}
