import type { CloudAccelerationStatus } from "@dafthunk/types";
import { and, eq, inArray, isNull } from "drizzle-orm";

import type { Database } from "../db";
import {
  aiInterfaceCloudAcceleration,
  mediaResources,
  organizationAiInterfaces,
} from "../db/schema";

export async function isAiInterfaceCloudAccelerationActive(
  db: Database,
  organizationId: string,
  aiInterfaceId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: aiInterfaceCloudAcceleration.id })
    .from(aiInterfaceCloudAcceleration)
    .where(
      and(
        eq(aiInterfaceCloudAcceleration.organizationId, organizationId),
        eq(aiInterfaceCloudAcceleration.aiInterfaceId, aiInterfaceId),
        isNull(aiInterfaceCloudAcceleration.disabledAt)
      )
    )
    .limit(1);

  return Boolean(row);
}

export async function listActiveAiInterfaceCloudAccelerations(
  db: Database,
  organizationId: string
): Promise<
  readonly {
    readonly id: string;
    readonly organizationId: string;
    readonly aiInterfaceId: string;
    readonly interfaceName: string;
    readonly enabledAt: string;
  }[]
> {
  const rows = await db
    .select({
      id: aiInterfaceCloudAcceleration.id,
      organizationId: aiInterfaceCloudAcceleration.organizationId,
      aiInterfaceId: aiInterfaceCloudAcceleration.aiInterfaceId,
      interfaceName: organizationAiInterfaces.name,
      enabledAt: aiInterfaceCloudAcceleration.enabledAt,
    })
    .from(aiInterfaceCloudAcceleration)
    .innerJoin(
      organizationAiInterfaces,
      eq(aiInterfaceCloudAcceleration.aiInterfaceId, organizationAiInterfaces.id)
    )
    .where(
      and(
        eq(aiInterfaceCloudAcceleration.organizationId, organizationId),
        isNull(aiInterfaceCloudAcceleration.disabledAt)
      )
    )
    .orderBy(aiInterfaceCloudAcceleration.enabledAt);

  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    aiInterfaceId: row.aiInterfaceId,
    interfaceName: row.interfaceName,
    enabledAt: row.enabledAt.toISOString(),
  }));
}

export async function disableAiInterfaceCloudAcceleration(
  db: Database,
  organizationId: string,
  aiInterfaceId: string
): Promise<boolean> {
  const result = await db
    .update(aiInterfaceCloudAcceleration)
    .set({ disabledAt: new Date() })
    .where(
      and(
        eq(aiInterfaceCloudAcceleration.organizationId, organizationId),
        eq(aiInterfaceCloudAcceleration.aiInterfaceId, aiInterfaceId),
        isNull(aiInterfaceCloudAcceleration.disabledAt)
      )
    )
    .returning({ id: aiInterfaceCloudAcceleration.id });

  return result.length > 0;
}

export async function enableAlwaysAiInterfaceCloudAcceleration(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly aiInterfaceId: string;
  }
): Promise<
  | {
      readonly id: string;
      readonly organizationId: string;
      readonly aiInterfaceId: string;
      readonly interfaceName: string;
      readonly enabledAt: string;
    }
  | null
> {
  const [iface] = await db
    .select({
      id: organizationAiInterfaces.id,
      name: organizationAiInterfaces.name,
    })
    .from(organizationAiInterfaces)
    .where(
      and(
        eq(organizationAiInterfaces.id, params.aiInterfaceId),
        eq(organizationAiInterfaces.organizationId, params.organizationId)
      )
    )
    .limit(1);

  if (!iface) {
    return null;
  }

  await db
    .update(aiInterfaceCloudAcceleration)
    .set({ disabledAt: new Date() })
    .where(
      and(
        eq(aiInterfaceCloudAcceleration.organizationId, params.organizationId),
        eq(aiInterfaceCloudAcceleration.aiInterfaceId, params.aiInterfaceId),
        isNull(aiInterfaceCloudAcceleration.disabledAt)
      )
    );

  const id = crypto.randomUUID();
  const enabledAt = new Date();

  await db.insert(aiInterfaceCloudAcceleration).values({
    id,
    organizationId: params.organizationId,
    aiInterfaceId: params.aiInterfaceId,
    enabledAt,
    disabledAt: null,
  });

  return {
    id,
    organizationId: params.organizationId,
    aiInterfaceId: params.aiInterfaceId,
    interfaceName: iface.name,
    enabledAt: enabledAt.toISOString(),
  };
}

export async function updateMediaResourceCloudAccelerationStatus(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly resourceIds: readonly string[];
    readonly status: CloudAccelerationStatus | null;
  }
): Promise<void> {
  if (params.resourceIds.length === 0) {
    return;
  }

  const ids = [...params.resourceIds];
  await db
    .update(mediaResources)
    .set({ cloudAccelerationStatus: params.status })
    .where(
      and(
        eq(mediaResources.organizationId, params.organizationId),
        inArray(mediaResources.id, ids)
      )
    );
}

export function resourceIdsFromPendingMedia(
  pendingMedia: readonly { readonly resourceId?: string }[],
  placeholderResourceIds: readonly string[] | undefined
): readonly string[] {
  const ids = pendingMedia
    .map((item) => item.resourceId?.trim())
    .filter((id): id is string => Boolean(id));
  if (ids.length > 0) {
    return ids;
  }
  return placeholderResourceIds ?? [];
}
