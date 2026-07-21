import type { NodeExecution, NodeType } from "@dafthunk/types";

import {
  buildReplicateInput,
  createReplicatePollContinuation,
  parseReplicateSubmitParams,
  submitReplicatePrediction,
} from "../../upstream/replicate-upstream";
import type { NodeContext } from "../../node-types";
import { ExecutableNode } from "../../node-types";

/**
 * Generic Replicate model node that executes any model based on
 * schema-derived inputs/outputs. Submit creates a prediction; the workflow
 * heartbeat polls Replicate until completion.
 *
 * @see https://replicate.com/docs/reference/http
 */
export class ReplicateModelNode extends ExecutableNode {
  public static readonly nodeType: NodeType = {
    id: "replicate-model",
    name: "Replicate Model",
    type: "replicate-model",
    description:
      "Run any model from the Replicate collection. Enter a model identifier, load its schema, and the node's inputs and outputs adapt automatically.",
    documentation: `Run any of the thousands of models available on [Replicate](https://replicate.com/explore).

### How to use

1. Browse the [Replicate model collection](https://replicate.com/explore) and find a model
2. Copy its identifier (shown at the top of the model page)
3. Paste it into this node and click **Load**
4. The node's inputs and outputs update to match the model's parameters

### Model identifier format

- \`provider/model\` — uses the latest version
- \`provider/model:version\` — pins a specific version

For example: \`google/veo-3\`, \`openai/whisper\`, \`xai/grok-imagine-video\`.`,
    referenceUrl: "https://replicate.com/explore",
    tags: ["AI", "Replicate", "Generic"],
    icon: "bot",
    inlinable: false,
    usage: 100,
    subscription: true,
    inputs: [
      {
        name: "model",
        type: "string",
        description:
          "Replicate model identifier (e.g., 'stability-ai/sdxl' or 'stability-ai/sdxl:version-id')",
        required: true,
      },
      {
        name: "timeout",
        type: "number",
        description: "Maximum time to wait for completion (minutes)",
        default: 30,
        minimum: 1,
        maximum: 120,
        hidden: true,
      },
      {
        name: "poll_interval",
        type: "number",
        description: "Time between status checks (seconds)",
        default: 10,
        minimum: 1,
        maximum: 60,
        hidden: true,
      },
    ],
    outputs: [],
  };

  async execute(context: NodeContext): Promise<NodeExecution> {
    try {
      const parsed = parseReplicateSubmitParams(context.inputs);
      if ("error" in parsed) {
        return this.createErrorResult(parsed.error);
      }

      const { REPLICATE_API_TOKEN } = context.env;
      if (!REPLICATE_API_TOKEN) {
        return this.createErrorResult(
          "REPLICATE_API_TOKEN environment variable is not configured"
        );
      }

      if (!context.objectStore) {
        return this.createErrorResult("ObjectStore is not available");
      }

      const input = await buildReplicateInput(
        context,
        this.node.inputs ?? [],
        context.objectStore
      );

      const submitResult = await submitReplicatePrediction({
        model: parsed.model,
        input,
        token: REPLICATE_API_TOKEN,
      });

      if (
        "status" in submitResult &&
        submitResult.status === "failed" &&
        typeof submitResult.error === "string"
      ) {
        return this.createErrorResult(submitResult.error);
      }

      const prediction = submitResult as { id: string };
      const continuation = createReplicatePollContinuation({
        nodeId: this.node.id,
        predictionId: prediction.id,
        pollIntervalMs: parsed.pollIntervalSec * 1000,
        timeoutMinutes: parsed.timeoutMinutes,
      });

      return {
        nodeId: this.node.id,
        status: "pending",
        usage: 0,
        pendingEvent: {
          type: `upstream-poll-${prediction.id}`,
          timeout: `${parsed.timeoutMinutes} minutes`,
        },
        pendingContinuation: continuation,
      };
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}
