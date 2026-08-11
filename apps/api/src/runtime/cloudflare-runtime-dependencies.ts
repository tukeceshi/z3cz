/**
 * Shared Cloudflare runtime dependency construction.
 *
 * Both WorkerRuntime and WorkflowRuntime use the same production services
 * (node registry, credential provider, object store, etc.) �?they only
 * differ in monitoring strategy. This module constructs the common
 * dependency bag once and is used by both runtime factories.
 */

import {
  type MonitoringService,
  type RuntimeDependencies,
} from "@dafthunk/runtime";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import { creditChecksEnabled } from "../utils/credits";
import { CloudflareCredentialService } from "./cloudflare-credential-service";
import { CloudflareCreditService } from "./cloudflare-credit-service";
import { PostgresDatabaseService } from "./postgres-database-service";
import { MockDatasetService } from "../mocks/dataset-service";
import { CloudflareExecutionStore } from "./cloudflare-execution-store";
import { CloudflareMailboxService } from "./cloudflare-mailbox-service";
import { createCloudflareNodeRegistry } from "./cloudflare-node-registry";
import {
  buildPresignedUrlConfig,
  CloudflareObjectStore,
} from "./cloudflare-object-store";
import { CloudflareQueueService } from "./cloudflare-queue-service";
import { CloudflareSchemaService } from "./cloudflare-schema-service";
import { CloudflareToolRegistry } from "./cloudflare-tool-registry";
import { createCodeModeExecutor } from "./code-mode-executor";
import { CloudflareAiInterfaceService } from "./cloudflare-ai-interface-service";
import { CloudflareImageModelService } from "./cloudflare-image-model-service";
import { CloudflareTextModelService } from "./cloudflare-text-model-service";
import { CloudflareVideoModelService } from "./cloudflare-video-model-service";
import { CloudflareAudioModelService } from "./cloudflare-audio-model-service";
import { createSandboxExecutor } from "./sandbox-executor";
import { createToolContext } from "./tool-context";
import { runtimeVersion } from "./version";
import { resolveAiImageStorage } from "../services/ai-image-storage";
import { resolveAiVideoStorage } from "../services/ai-video-storage";
import { resolveAiAudioStorage } from "../services/ai-audio-storage";
import { assertCloudStorageHealthyForGenerativeMedia } from "../services/assert-cloud-storage-healthy-for-generative-media";
import { createWorkflowGenerationJobTracker } from "../services/workflow-generation-job-tracker";

export async function buildDependencies(
  env: Bindings,
  monitoringService: MonitoringService
): Promise<RuntimeDependencies<Bindings>> {
  const nodeRegistry = await createCloudflareNodeRegistry(env, true);
  const objectStore = new CloudflareObjectStore(
    env.RESSOURCES,
    buildPresignedUrlConfig(env)
  );
  const credentialProvider = new CloudflareCredentialService(env);
  const databaseService = new PostgresDatabaseService(env);
  const datasetService = new MockDatasetService();
  const queueService = new CloudflareQueueService(env);
  const schemaService = new CloudflareSchemaService(env);
  const mailboxService = new CloudflareMailboxService(env);
  const codeModeExecutor = createCodeModeExecutor(env) ?? undefined;
  // One sandbox container per execution �?fresh ID isolates runs from each other
  // while reusing the same sandbox across nodes within a run.
  const sandboxExecutor =
    createSandboxExecutor(env, `exec-${crypto.randomUUID()}`) ?? undefined;

  const toolRegistry = new CloudflareToolRegistry(
    nodeRegistry,
    (nodeId, inputs) =>
      createToolContext(nodeId, inputs, env, objectStore, credentialProvider, {
        databaseService,
        datasetService,
        queueService,
        schemaService,
        codeModeExecutor,
        sandboxExecutor,
      })
  );

  return {
    nodeRegistry,
    credentialProvider,
    executionStore: new CloudflareExecutionStore(env),
    monitoringService,
    creditService: new CloudflareCreditService(
      env.KV,
      createDatabase(env),
      !creditChecksEnabled(env.CLOUDFLARE_ENV)
    ),
    objectStore,
    toolRegistry,
    databaseService,
    datasetService,
    queueService,
    schemaService,
    mailboxService,
    codeModeExecutor,
    sandboxExecutor,
    aiInterfaceService: new CloudflareAiInterfaceService(env),
    textModelService: new CloudflareTextModelService(env),
    imageModelService: new CloudflareImageModelService(env),
    videoModelService: new CloudflareVideoModelService(env),
    audioModelService: new CloudflareAudioModelService(env),
    resolveAiImageStorage: async (params) => {
      await assertCloudStorageHealthyForGenerativeMedia(
        env,
        params.organizationId
      );
      return resolveAiImageStorage(env, params);
    },
    resolveAiVideoStorage: async (params) => {
      await assertCloudStorageHealthyForGenerativeMedia(
        env,
        params.organizationId
      );
      return resolveAiVideoStorage(env, params);
    },
    resolveAiAudioStorage: async (params) => {
      await assertCloudStorageHealthyForGenerativeMedia(
        env,
        params.organizationId
      );
      return resolveAiAudioStorage(env, params);
    },
    trackWorkflowGenerationJob: createWorkflowGenerationJobTracker(env),
    runtimeVersion,
  };
}
