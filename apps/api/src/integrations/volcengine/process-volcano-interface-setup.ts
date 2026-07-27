import type {
  VolcanoInterfaceMetadata,
  VolcanoInterfaceSetupQueueMessage,
  VolcanoSetupStatus,
} from "@dafthunk/types";
import { VOLCANO_TOS_DEFAULT_PREFIX } from "@dafthunk/types";

import type { Bindings } from "../../context";
import { createDatabase } from "../../db";
import {
  getOrganizationAiInterfaceRow,
  updateOrganizationAiInterface,
} from "../../db/ai-interface-queries";
import { refreshOrgCloudStorageHealthAfterConfigChange } from "../../services/assert-cloud-storage-healthy-for-generative-media";
import { mergeVolcanoTosStorage } from "../../services/resolve-org-cloud-storage";
import { withApiKeyHint } from "../../utils/api-key-hint";
import { ensureVolcanoTosBucketCreated } from "./create-volcano-tos-bucket";
import {
  ensureVolcanoApiKey,
  getVolcanoCredentials,
} from "./ensure-api-key";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
  serializeInterfaceMetadata,
} from "./metadata";
import { probeVolcanoTosServiceStatus } from "./probe-volcano-tos-service";
import { seedVolcanoPackageListCache } from "./seed-volcano-package-list-cache";
import { VolcengineTosClient } from "./tos-client";
import { isVolcanoTosNotOpenedError } from "./tos-errors";

async function setSetupStatus(params: {
  readonly env: Bindings;
  readonly organizationId: string;
  readonly interfaceId: string;
  readonly status: VolcanoSetupStatus;
  readonly setupError?: string | null;
  readonly metadataRaw?: string;
  readonly apiKeyEncrypted?: string;
}): Promise<void> {
  const db = createDatabase(params.env);
  const row = await getOrganizationAiInterfaceRow(
    db,
    params.organizationId,
    params.interfaceId
  );
  if (!row) {
    return;
  }

  let metadataRaw = params.metadataRaw ?? row.metadata ?? null;
  if (metadataRaw) {
    const metadata = parseInterfaceMetadata(metadataRaw);
    if (isVolcanoMetadata(metadata)) {
      metadataRaw = serializeInterfaceMetadata({
        ...metadata,
        setupStatus: params.status,
        setupError: params.setupError ?? null,
      });
    }
  }

  await updateOrganizationAiInterface(db, params.organizationId, params.interfaceId, {
    volcanoSetupStatus: params.status,
    ...(metadataRaw ? { metadata: metadataRaw } : {}),
    ...(params.apiKeyEncrypted
      ? { apiKeyEncrypted: params.apiKeyEncrypted }
      : {}),
  });
}

async function applyTosSetup(params: {
  readonly env: Bindings;
  readonly organizationId: string;
  readonly interfaceId: string;
  readonly tosSetup: NonNullable<VolcanoInterfaceSetupQueueMessage["tosSetup"]>;
}): Promise<void> {
  if (!params.tosSetup.enabled) {
    return;
  }

  const db = createDatabase(params.env);
  const row = await getOrganizationAiInterfaceRow(
    db,
    params.organizationId,
    params.interfaceId
  );
  if (!row) {
    return;
  }

  const current = parseInterfaceMetadata(row.metadata);
  if (!isVolcanoMetadata(current)) {
    return;
  }

  let tosBucket = params.tosSetup.bucket;
  const credentials = await getVolcanoCredentials(
    params.env,
    params.organizationId,
    row.metadata
  );
  if (!credentials) {
    throw new Error("Volcano credentials not configured");
  }

  if (params.tosSetup.createBucket) {
    const probe = await probeVolcanoTosServiceStatus({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      region: params.tosSetup.region,
    });
    if (probe.status === "not_opened") {
      return;
    }
    if (probe.status !== "opened") {
      throw new Error(probe.message ?? "Failed to verify TOS access");
    }
    const client = VolcengineTosClient.forRegion({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      region: params.tosSetup.region,
    });
    try {
      tosBucket = await ensureVolcanoTosBucketCreated({
        client,
        bucket: tosBucket,
        organizationId: params.organizationId,
      });
    } catch (error) {
      if (isVolcanoTosNotOpenedError(error)) {
        return;
      }
      throw error;
    }
  }

  const nextMetadata = mergeVolcanoTosStorage(current, {
    enabled: true,
    bucket: tosBucket,
    region: params.tosSetup.region,
    prefix: VOLCANO_TOS_DEFAULT_PREFIX,
  });

  await updateOrganizationAiInterface(
    db,
    params.organizationId,
    params.interfaceId,
    {
      metadata: serializeInterfaceMetadata(nextMetadata),
    }
  );
  await refreshOrgCloudStorageHealthAfterConfigChange(
    params.env,
    params.organizationId
  );
}

/**
 * Background setup after fast volcano create: issue Ark key, seed packages, optional TOS.
 */
export async function processVolcanoInterfaceSetup(
  env: Bindings,
  message: VolcanoInterfaceSetupQueueMessage
): Promise<void> {
  const db = createDatabase(env);
  const row = await getOrganizationAiInterfaceRow(
    db,
    message.organizationId,
    message.interfaceId
  );
  if (!row) {
    console.warn(
      `[volcano-setup] interface missing ${message.interfaceId}, ack`
    );
    return;
  }

  if (row.volcanoSetupStatus === "ready") {
    return;
  }

  await setSetupStatus({
    env,
    organizationId: message.organizationId,
    interfaceId: message.interfaceId,
    status: "running",
  });

  try {
    const ensured = await ensureVolcanoApiKey({
      env,
      organizationId: message.organizationId,
      metadataRaw: row.metadata,
      apiKeyEncrypted: row.apiKeyEncrypted,
    });

    let metadataRaw = ensured.metadataRaw;
    if (ensured.apiKey) {
      const metadata = parseInterfaceMetadata(metadataRaw);
      if (isVolcanoMetadata(metadata)) {
        metadataRaw = serializeInterfaceMetadata(
          withApiKeyHint(
            metadata as VolcanoInterfaceMetadata & Record<string, unknown>,
            ensured.apiKey
          )
        );
      }
    }

    await updateOrganizationAiInterface(
      db,
      message.organizationId,
      message.interfaceId,
      {
        metadata: metadataRaw,
        apiKeyEncrypted: ensured.apiKeyEncrypted,
        volcanoSetupStatus: "running",
      }
    );

    await seedVolcanoPackageListCache({
      env,
      organizationId: message.organizationId,
      interfaceId: message.interfaceId,
    });

    if (message.tosSetup?.enabled) {
      await applyTosSetup({
        env,
        organizationId: message.organizationId,
        interfaceId: message.interfaceId,
        tosSetup: message.tosSetup,
      });
    }

    await setSetupStatus({
      env,
      organizationId: message.organizationId,
      interfaceId: message.interfaceId,
      status: "ready",
      setupError: null,
    });
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Volcano setup failed";
    console.error(
      `[volcano-setup] failed for ${message.interfaceId}:`,
      error
    );
    await setSetupStatus({
      env,
      organizationId: message.organizationId,
      interfaceId: message.interfaceId,
      status: "failed",
      setupError: messageText,
    });
    throw error;
  }
}
