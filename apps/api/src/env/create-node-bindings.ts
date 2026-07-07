import type { Bindings } from "../context";
import { setNodeBindings } from "./node-bindings-ref";
import { MemoryKvNamespace } from "../storage/memory-kv";
import { createStorageBuckets } from "../storage/storage-provider";
import { createNodeSendEmailBinding } from "../services/node-send-email-binding";
import { createNodeWorkflowQueue } from "../runtime/node-workflow-queue";
import { createNodeMailboxNamespace } from "../runtime/node-mailbox-store";
import { createNodeAgentRunnerNamespace } from "../runtime/node-agent-runner";
import { createNodeEmailAgentRunnerNamespace } from "../runtime/node-email-agent-runner";

function createStubRateLimit(): RateLimit {
  return {} as RateLimit;
}

function createStubDurableObjectNamespace<T>(): DurableObjectNamespace<T> {
  return {
    idFromName: (name: string) =>
      ({
        toString: () => name,
      }) as DurableObjectId,
    idFromString: (id: string) =>
      ({
        toString: () => id,
      }) as DurableObjectId,
    newUniqueId: () =>
      ({
        toString: () => crypto.randomUUID(),
      }) as DurableObjectId,
    get: () => {
      throw new Error(
        "Durable Objects are not available in the Node.js runtime yet"
      );
    },
  } as DurableObjectNamespace<T>;
}

function createStubAnalytics(): AnalyticsEngineDataset {
  return {
    writeDataPoint: () => undefined,
  } as AnalyticsEngineDataset;
}

function createStubAi(): Ai {
  return {} as Ai;
}

function createNodeExecuteWorkflowBinding(): Workflow<unknown> {
  // Lazy import avoids circular dependency at module load time.
  return {
    create: async () => {
      throw new Error(
        "Use nodeWorkflowExecutionService.startExecution on Node runtime"
      );
    },
    createBatch: async () => {
      throw new Error(
        "Use nodeWorkflowExecutionService.startExecution on Node runtime"
      );
    },
    get: async (executionId: string) => {
      const { nodeWorkflowExecutionService } = await import(
        "../runtime/node-workflow-execution-service"
      );
      const instance =
        await nodeWorkflowExecutionService.getInstance(executionId);
      if (!instance) {
        throw new Error(
          `Workflow execution ${executionId} not found or finished`
        );
      }
      return instance;
    },
  } as Workflow<unknown>;
}

function createStubQueue(): Queue {
  return createNodeWorkflowQueue();
}

export async function createNodeBindings(
  env: Record<string, string>
): Promise<Bindings> {
  const storage = await createStorageBuckets(env);
  const outboxDir = `${env.LOCAL_STORAGE_PATH ?? "/app/data/storage"}/outbound-emails`;

  const bindings: Bindings = {
    DATABASE_URL:
      env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/postgres",
    KV: new MemoryKvNamespace(),
    RATE_LIMIT_DEFAULT: createStubRateLimit(),
    RATE_LIMIT_AUTH: createStubRateLimit(),
    RATE_LIMIT_EXECUTE: createStubRateLimit(),
    EXECUTE: createNodeExecuteWorkflowBinding(),
    WORKFLOW_AGENT: createStubDurableObjectNamespace(),
    AGENT_RUNNER: createNodeAgentRunnerNamespace(),
    EMAIL_AGENT_RUNNER: createNodeEmailAgentRunnerNamespace(),
    MAILBOX: createNodeMailboxNamespace(),
    WORKFLOW_QUEUE: createStubQueue(),
    RESSOURCES: storage.RESSOURCES,
    DATASETS: storage.DATASETS,
    DATASETS_AUTORAG: env.DATASETS_AUTORAG ?? "",
    INBOXES: storage.INBOXES,
    INBOXES_AUTORAG: env.INBOXES_AUTORAG ?? "",
    AI: createStubAi(),
    AI_SEARCH: {} as AiSearchNamespace,
    AI_OPTIONS: {} as AiOptions,
    EXECUTIONS: createStubAnalytics(),
    WEB_HOST: env.WEB_HOST ?? "http://localhost:3101",
    WEBSITE_URL: env.WEBSITE_URL ?? "http://localhost:3100",
    EMAIL_DOMAIN: env.EMAIL_DOMAIN ?? "mail.localhost",
    JWT_SECRET: env.JWT_SECRET ?? "dev-insecure-jwt-secret",
    CLOUDFLARE_ENV: env.CLOUDFLARE_ENV ?? "development",
    RUNTIME: "node",
    CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID ?? "",
    CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN ?? "",
    CLOUDFLARE_AI_GATEWAY_ID: env.CLOUDFLARE_AI_GATEWAY_ID,
    GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: env.GITHUB_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    INTEGRATION_GOOGLE_MAIL_CLIENT_ID: env.INTEGRATION_GOOGLE_MAIL_CLIENT_ID,
    INTEGRATION_GOOGLE_MAIL_CLIENT_SECRET:
      env.INTEGRATION_GOOGLE_MAIL_CLIENT_SECRET,
    INTEGRATION_GOOGLE_CALENDAR_CLIENT_ID:
      env.INTEGRATION_GOOGLE_CALENDAR_CLIENT_ID,
    INTEGRATION_GOOGLE_CALENDAR_CLIENT_SECRET:
      env.INTEGRATION_GOOGLE_CALENDAR_CLIENT_SECRET,
    INTEGRATION_DISCORD_CLIENT_ID: env.INTEGRATION_DISCORD_CLIENT_ID,
    INTEGRATION_DISCORD_CLIENT_SECRET: env.INTEGRATION_DISCORD_CLIENT_SECRET,
    INTEGRATION_GITHUB_CLIENT_ID: env.INTEGRATION_GITHUB_CLIENT_ID,
    INTEGRATION_GITHUB_CLIENT_SECRET: env.INTEGRATION_GITHUB_CLIENT_SECRET,
    INTEGRATION_REDDIT_CLIENT_ID: env.INTEGRATION_REDDIT_CLIENT_ID,
    INTEGRATION_REDDIT_CLIENT_SECRET: env.INTEGRATION_REDDIT_CLIENT_SECRET,
    INTEGRATION_LINKEDIN_CLIENT_ID: env.INTEGRATION_LINKEDIN_CLIENT_ID,
    INTEGRATION_LINKEDIN_CLIENT_SECRET: env.INTEGRATION_LINKEDIN_CLIENT_SECRET,
    INTEGRATION_X_CLIENT_ID: env.INTEGRATION_X_CLIENT_ID,
    INTEGRATION_X_CLIENT_SECRET: env.INTEGRATION_X_CLIENT_SECRET,
    INTEGRATION_WORDPRESS_CLIENT_ID: env.INTEGRATION_WORDPRESS_CLIENT_ID,
    INTEGRATION_WORDPRESS_CLIENT_SECRET:
      env.INTEGRATION_WORDPRESS_CLIENT_SECRET,
    TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: env.TWILIO_PHONE_NUMBER,
    SEND_EMAIL: createNodeSendEmailBinding(outboxDir),
    SEND_EMAIL_FROM: env.SEND_EMAIL_FROM ?? `noreply@${env.EMAIL_DOMAIN ?? "mail.localhost"}`,
    NODE_OUTBOX_DIR: outboxDir,
    INBOUND_EMAIL_SECRET: env.INBOUND_EMAIL_SECRET,
    SUPPORT_EMAIL_HANDLE: env.SUPPORT_EMAIL_HANDLE,
    SUPPORT_EMAIL_FROM: env.SUPPORT_EMAIL_FROM,
    HUGGINGFACE_API_KEY: env.HUGGINGFACE_API_KEY,
    REPLICATE_API_TOKEN: env.REPLICATE_API_TOKEN,
    GOOGLE_API_KEY: env.GOOGLE_API_KEY,
    TAVILY_API_KEY: env.TAVILY_API_KEY,
    R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: env.R2_BUCKET_NAME,
    SECRET_MASTER_KEY:
      env.SECRET_MASTER_KEY ?? "dev-insecure-secret-master-key",
    FORM_SIGNING_KEY: env.FORM_SIGNING_KEY ?? "dev-insecure-form-signing-key",
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_ID_PRO: env.STRIPE_PRICE_ID_PRO,
    STRIPE_METER_ID: env.STRIPE_METER_ID,
    DISCORD_URL: env.DISCORD_URL,
    GITHUB_URL: env.GITHUB_URL,
  };

  setNodeBindings(bindings);
  return bindings;
}
