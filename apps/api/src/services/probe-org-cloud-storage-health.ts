import type { CloudStorageHealthSnapshot } from "@dafthunk/types";
import {
  CLOUD_STORAGE_DEGRADED_FAILURE_THRESHOLD,
  CLOUD_STORAGE_HEALTH_CHECK_TTL_MS,
} from "@dafthunk/types";

import type { Bindings } from "../context";
import { createDatabase, type Database } from "../db";
import {
  getOrganizationCloudStorageHealth,
  upsertOrganizationCloudStorageHealth,
} from "../db/cloud-storage-health-queries";
import { probeVolcanoTosServiceStatus } from "../integrations/volcengine/probe-volcano-tos-service";
import { getBucketCors } from "../integrations/volcengine/tos-sdk-cors";
import { VolcengineTosClient } from "../integrations/volcengine/tos-client";
import { decryptSecret } from "../utils/encryption";
import {
  classifyCloudStorageHealthFromError,
  applyCloudStorageFailureEscalation,
  mapProbeStatusToBlockReason,
  mapProbeStatusToHealth,
} from "./classify-cloud-storage-health";
import {
  corsRulesAllowDirectUpload,
  ensureDirectUploadCors,
  mergeDirectUploadCorsOrigins,
} from "./ensure-direct-upload-cors";
import { resolveOrgCloudStorage } from "./resolve-org-cloud-storage";

function isHealthSnapshotStale(checkedAt: string): boolean {
  return Date.parse(checkedAt) + CLOUD_STORAGE_HEALTH_CHECK_TTL_MS <= Date.now();
}

export async function probeOrgCloudStorageHealth(
  env: Bindings,
  organizationId: string,
  options?: { readonly extraCorsOrigins?: readonly string[] }
): Promise<CloudStorageHealthSnapshot | null> {
  const db = createDatabase(env);
  return probeOrgCloudStorageHealthWithDb(db, env, organizationId, options);
}

export async function probeOrgCloudStorageHealthWithDb(
  db: Database,
  env: Bindings,
  organizationId: string,
  options?: { readonly extraCorsOrigins?: readonly string[] }
): Promise<CloudStorageHealthSnapshot | null> {
  const cloud = await resolveOrgCloudStorage(db, organizationId);
  if (!cloud) {
    return null;
  }

  const secretAccessKey = await decryptSecret(
    cloud.secretAccessKeyEncrypted,
    env,
    organizationId
  );

  const checkedAt = new Date().toISOString();
  const base = {
    interfaceId: cloud.interfaceId,
    bucket: cloud.tosStorage.bucket,
    region: cloud.tosStorage.region,
    checkedAt,
  } satisfies Pick<
    CloudStorageHealthSnapshot,
    "interfaceId" | "bucket" | "region" | "checkedAt"
  >;

  try {
    const probe = await probeVolcanoTosServiceStatus({
      accessKeyId: cloud.accessKeyId,
      secretAccessKey,
      region: cloud.region,
    });

    if (probe.status !== "opened") {
      const status = mapProbeStatusToHealth({
        probeStatus: probe.status,
        message: probe.message,
      });
      const snapshot: CloudStorageHealthSnapshot = {
        ...base,
        status,
        reason:
          probe.status === "not_opened" || probe.status === "auth_error"
            ? mapProbeStatusToBlockReason(probe.status)
            : null,
        message: probe.message ?? null,
        consecutiveFailureCount:
          status === "blocked"
            ? CLOUD_STORAGE_DEGRADED_FAILURE_THRESHOLD
            : 0,
      };
      await upsertOrganizationCloudStorageHealth(db, {
        organizationId,
        snapshot,
      });
      return snapshot;
    }

    const bucketClient = new VolcengineTosClient({
      accessKeyId: cloud.accessKeyId,
      secretAccessKey,
      region: cloud.tosStorage.region,
      bucket: cloud.tosStorage.bucket,
    });

    const buckets = probe.buckets;
    if (!buckets.includes(cloud.tosStorage.bucket)) {
      try {
        await bucketClient.headBucket();
      } catch (error) {
        const classified = classifyCloudStorageHealthFromError(error);
        const snapshot: CloudStorageHealthSnapshot = {
          ...base,
          ...classified,
          consecutiveFailureCount:
            classified.status === "blocked"
              ? CLOUD_STORAGE_DEGRADED_FAILURE_THRESHOLD
              : 0,
        };
        await upsertOrganizationCloudStorageHealth(db, {
          organizationId,
          snapshot,
        });
        return snapshot;
      }
    }

    await bucketClient.signPutObjectUpload({
      key: `${cloud.tosStorage.prefix.replace(/\/$/, "")}/.health-probe`,
      mimeType: "application/octet-stream",
      contentLength: 0,
    });

    const corsOrigins = mergeDirectUploadCorsOrigins(env, options?.extraCorsOrigins);
    const bucketCredentials = {
      accessKeyId: cloud.accessKeyId,
      secretAccessKey,
      region: cloud.tosStorage.region,
      bucket: cloud.tosStorage.bucket,
    } as const;
    try {
      await ensureDirectUploadCors({
        credentials: bucketCredentials,
        allowedOrigins: corsOrigins,
      });
    } catch (error) {
      const classified = classifyCloudStorageHealthFromError(error);
      const snapshot: CloudStorageHealthSnapshot = {
        ...base,
        ...classified,
        consecutiveFailureCount:
          classified.status === "blocked"
            ? CLOUD_STORAGE_DEGRADED_FAILURE_THRESHOLD
            : 0,
      };
      await upsertOrganizationCloudStorageHealth(db, {
        organizationId,
        snapshot,
      });
      return snapshot;
    }

    const corsRules = await getBucketCors(bucketCredentials);
    if (!corsRulesAllowDirectUpload(corsRules, corsOrigins)) {
      const snapshot: CloudStorageHealthSnapshot = {
        ...base,
        status: "blocked",
        reason: "cors_not_configured",
        message: "Bucket CORS does not allow browser direct upload",
        consecutiveFailureCount: CLOUD_STORAGE_DEGRADED_FAILURE_THRESHOLD,
      };
      await upsertOrganizationCloudStorageHealth(db, {
        organizationId,
        snapshot,
      });
      return snapshot;
    }

    const snapshot: CloudStorageHealthSnapshot = {
      ...base,
      status: "healthy",
      reason: null,
      message: null,
      consecutiveFailureCount: 0,
    };
    await upsertOrganizationCloudStorageHealth(db, {
      organizationId,
      snapshot,
    });
    return snapshot;
  } catch (error) {
    const classified = classifyCloudStorageHealthFromError(error);
    const snapshot: CloudStorageHealthSnapshot = {
      ...base,
      ...classified,
      consecutiveFailureCount:
        classified.status === "blocked"
          ? CLOUD_STORAGE_DEGRADED_FAILURE_THRESHOLD
          : 0,
    };
    await upsertOrganizationCloudStorageHealth(db, {
      organizationId,
      snapshot,
    });
    return snapshot;
  }
}

export async function getOrRefreshOrgCloudStorageHealth(
  env: Bindings,
  organizationId: string,
  options?: {
    readonly force?: boolean;
    readonly extraCorsOrigins?: readonly string[];
  }
): Promise<CloudStorageHealthSnapshot | null> {
  const db = createDatabase(env);
  const cloud = await resolveOrgCloudStorage(db, organizationId);
  if (!cloud) {
    return null;
  }

  const cached = await getOrganizationCloudStorageHealth(db, organizationId);
  if (
    cached &&
    !options?.force &&
    !isHealthSnapshotStale(cached.checkedAt) &&
    cached.interfaceId === cloud.interfaceId &&
    cached.bucket === cloud.tosStorage.bucket
  ) {
    return cached;
  }

  return probeOrgCloudStorageHealthWithDb(db, env, organizationId, {
    extraCorsOrigins: options?.extraCorsOrigins,
  });
}

export async function recordCloudStorageHealthFromError(
  env: Bindings,
  organizationId: string,
  error: unknown
): Promise<CloudStorageHealthSnapshot | null> {
  const db = createDatabase(env);
  const cloud = await resolveOrgCloudStorage(db, organizationId);
  if (!cloud) {
    return null;
  }

  const classified = classifyCloudStorageHealthFromError(error);
  const previous = await getOrganizationCloudStorageHealth(db, organizationId);
  const escalated = applyCloudStorageFailureEscalation({
    classified,
    previousFailureCount: previous?.consecutiveFailureCount,
  });

  const snapshot: CloudStorageHealthSnapshot = {
    interfaceId: cloud.interfaceId,
    bucket: cloud.tosStorage.bucket,
    region: cloud.tosStorage.region,
    checkedAt: new Date().toISOString(),
    ...escalated,
  };

  await upsertOrganizationCloudStorageHealth(db, {
    organizationId,
    snapshot,
  });
  return snapshot;
}
