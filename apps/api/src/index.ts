import { createApp } from "./app";
import { handleIncomingEmail } from "./email";
import { handleQueueMessages } from "./queue";
import { handleScheduledEvent } from "./scheduled";

export { WorkflowRuntimeEntrypoint as Runtime } from "./runtime/workflow-runtime-entrypoint";

const app = createApp({ runtime: "workers" });

export { WorkflowAgent } from "./durable-objects/workflow-agent";
export { Sandbox } from "@cloudflare/sandbox";
export { FFmpegContainer } from "./containers/ffmpeg-container";
export { LanguageSandbox } from "./containers/language-sandbox";
export { AgentRunner } from "./durable-objects/agent-runner";
export { EmailAgentRunner } from "./durable-objects/email-agent-runner";
export { MailboxDO } from "./durable-objects/mailbox-do";

export default {
  email: handleIncomingEmail,
  queue: handleQueueMessages,
  scheduled: handleScheduledEvent,
  fetch: app.fetch,
};
