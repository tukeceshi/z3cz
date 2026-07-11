import type { NodeExecution, NodeType } from "@dafthunk/types";

import {
  buildReplicateInput,
  createReplicatePollContinuation,
  submitReplicatePrediction,
} from "../../upstream/replicate-upstream";
import type { NodeContext } from "../../node-types";
import { ExecutableNode, isObjectReference } from "../../node-types";
import { awaitReplicateOrPending } from "./await-replicate-or-pending";

export const AI_VIDEO_NODE_TYPE = "ai-video" as const;

/**
 * AI Video node — gateway-style video generation.
 * Supports manual_videos bypass and Replicate for generation.
 */
export class AiVideoNode extends ExecutableNode {
  public static readonly nodeType: NodeType = {
    id: "ai-video",
    name: "AI Video",
    type: "ai-video",
    description:
      "Generate videos using AI models via Replicate. Supports manual video bypass for testing.",
    documentation: `Generates videos using AI models.

### Inputs
- **model**: Replicate model identifier (e.g. \`google/veo-3\`).
- **prompt**: Video generation prompt.
- **params**: Additional JSON parameters passed to the model.
- **manual_videos**: JSON array of ObjectReferences — bypasses generation and returns these directly.

### Outputs
- **videos**: Array of generated video references.`,
    tags: ["newai"],
    icon: "video",
    inlinable: false,
    usage: 50,
    inputs: [
      {
        name: "model",
        type: "string",
        description: "Replicate model identifier (e.g. google/veo-3).",
        required: false,
      },
      {
        name: "prompt",
        type: "string",
        description: "Video generation prompt.",
        required: false,
      },
      {
        name: "params",
        type: "json",
        description: "Additional model parameters as JSON.",
        required: false,
        hidden: true,
      },
      {
        name: "manual_videos",
        type: "json",
        description:
          "JSON array of ObjectReferences to return directly, bypassing generation.",
        required: false,
        hidden: true,
      },
    ],
    outputs: [
      {
        name: "videos",
        type: "video",
        repeated: true,
        description: "Generated videos.",
      },
    ],
  };

  public async execute(context: NodeContext): Promise<NodeExecution> {
    // Manual bypass
    const manualVideos = context.inputs.manual_videos;
    if (Array.isArray(manualVideos) && manualVideos.length > 0) {
      const refs = manualVideos.filter((v) => isObjectReference(v));
      if (refs.length > 0) {
        return this.createSuccessResult({ videos: refs });
      }
    }

    const model = context.inputs.model;
    if (typeof model !== "string" || model.trim().length === 0) {
      return this.createErrorResult(
        "A model identifier is required (e.g. google/veo-3)."
      );
    }

    const prompt = context.inputs.prompt;
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return this.createErrorResult("A prompt is required.");
    }

    const { REPLICATE_API_TOKEN } = context.env;
    if (!REPLICATE_API_TOKEN) {
      return this.createErrorResult(
        "REPLICATE_API_TOKEN is not configured. Please contact your platform administrator."
      );
    }

    if (!context.objectStore) {
      return this.createErrorResult("Object store is not available.");
    }

    const extraParams =
      context.inputs.params && typeof context.inputs.params === "object"
        ? (context.inputs.params as Record<string, unknown>)
        : {};

    const input = await buildReplicateInput(
      context,
      this.node.inputs ?? [],
      context.objectStore
    );

    const submitResult = await submitReplicatePrediction({
      model: model.trim(),
      input: { ...input, prompt, ...extraParams },
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
      pollIntervalMs: 10000,
      timeoutMinutes: 60,
    });

    return awaitReplicateOrPending({
      context,
      continuation,
      token: REPLICATE_API_TOKEN,
      timeoutLabel: "60 minutes",
      nodeOutputs: AiVideoNode.nodeType.outputs ?? [],
      createSuccessResult: (outputs, usage) =>
        this.createSuccessResult(outputs, usage),
      createErrorResult: (error, usage) => this.createErrorResult(error, usage),
    });
  }
}
