import type { CloudStorageHealthSnapshot } from "@dafthunk/types";
import {
  buildOrgCloudStorageConfiguredStatus,
  buildOrgCloudStorageStatus,
} from "@dafthunk/types";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import { listOrganizationAiInterfaces } from "../db/ai-interface-queries";
import {
  CloudStorageUnhealthyError,
} from "./classify-cloud-storage-health";
import { blocksGenerativeMediaForHealth } from "@dafthunk/types";
import {
  getOrRefreshOrgCloudStorageHealth,
  probeOrgCloudStorageHealth,
} from "./probe-org-cloud-storage-health";
import {
  isOrgCloudStorageConfigured,
  resolveOrgCloudStorage,
} from "./resolve-org-cloud-storage";
import { ensureOrgDirectUploadCors } from "./ensure-direct-upload-cors";

export async function getOrgCloudStorageConfiguredResponse(
  env: Bindings,
  organizationId: string
): Promise<ReturnType<typeof buildOrgCloudStorageConfiguredStatus>> {
  const db = createDatabase(env);
  const interfaces = await listOrganizationAiInterfaces(db, organizationId);
  const configured = isOrgCloudStorageConfigured(interfaces);

  if (!configured) {
    return buildOrgCloudStorageConfiguredStatus({ configured: false });
  }

  const cloud = await resolveOrgCloudStorage(db, organizationId);
  return buildOrgCloudStorageConfiguredStatus({
    configured: true,
    interfaceId: cloud?.interfaceId,
  });
}

export async function getOrgCloudStorageStatusResponse(
  env: Bindings,
  organizationId: string,
  options?: {
    readonly force?: boolean;
    readonly extraCorsOrigins?: readonly string[];
  }
): Promise<ReturnType<typeof buildOrgCloudStorageStatus>> {
  const db = createDatabase(env);
  const interfaces = await listOrganizationAiInterfaces(db, organizationId);
  const configured = isOrgCloudStorageConfigured(interfaces);

  if (!configured) {
    return buildOrgCloudStorageStatus({ configured: false });
  }

  const cloud = await resolveOrgCloudStorage(db, organizationId);
  const health = await getOrRefreshOrgCloudStorageHealth(env, organizationId, {
    force: options?.force,
    extraCorsOrigins: options?.extraCorsOrigins,
  });

  return buildOrgCloudStorageStatus({
    configured: true,
    interfaceId: cloud?.interfaceId,
    health,
  });
}

export async function assertCloudStorageHealthyForGenerativeMedia(
  env: Bindings,
  organizationId: string
): Promise<CloudStorageHealthSnapshot | null> {
  const db = createDatabase(env);
  const cloud = await resolveOrgCloudStorage(db, organizationId);
  if (!cloud) {
    return null;
  }

  const health = await getOrRefreshOrgCloudStorageHealth(env, organizationId);
  if (!health || blocksGenerativeMediaForHealth(true, health)) {
    throw new CloudStorageUnhealthyError(
      health ?? {
        status: "blocked",
        reason: null,
        message: "Cloud storage health is unknown",
        checkedAt: new Date().toISOString(),
        interfaceId: cloud.interfaceId,
        bucket: cloud.tosStorage.bucket,
        region: cloud.tosStorage.region,
      }
    );
  }

  return health;
}

export async function refreshOrgCloudStorageHealthAfterConfigChange(
  env: Bindings,
  organizationId: string
): Promise<CloudStorageHealthSnapshot | null> {
  await ensureOrgDirectUploadCors(env, organizationId);
  return probeOrgCloudStorageHealth(env, organizationId);
}
