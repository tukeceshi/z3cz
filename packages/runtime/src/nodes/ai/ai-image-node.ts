import type { NodeExecution, NodeType } from "@dafthunk/types";

import {
  buildReplicateInput,
  createReplicatePollContinuation,
  submitReplicatePrediction,
} from "../../upstream/replicate-upstream";
import type { NodeContext } from "../../node-types";
import { ExecutableNode, isObjectReference } from "../../node-types";
import { awaitReplicateOrPending } from "./await-replicate-or-pending";

export const AI_IMAGE_NODE_TYPE = "ai-image" as const;

/**
 * AI Image node — gateway-style image generation.
 * Supports manual_images bypass and Replicate for generation.
 */
export class AiImageNode extends ExecutableNode {
  public static readonly nodeType: NodeType = {
    id: "ai-image",
    name: "AI Image",
    type: "ai-image",
    description:
      "Generate images using AI models via Replicate. Supports manual image bypass for testing.",
    documentation: `Generates images using AI models.

### Inputs
- **model**: Replicate model identifier (e.g. \`black-forest-labs/flux-schnell\`).
- **prompt**: Image generation prompt.
- **count**: Number of images to generate (default 1).
- **params**: Additional JSON parameters passed to the model.
- **manual_images**: JSON array of ObjectReferences — bypasses generation and returns these directly.

### Outputs
- **images**: Array of generated image references.`,
    tags: ["newai"],
    icon: "image",
    inlinable: false,
    usage: 10,
    inputs: [
      {
        name: "model",
        type: "string",
        description:
          "Replicate model identifier (e.g. black-forest-labs/flux-schnell).",
        required: false,
      },
      {
        name: "prompt",
        type: "string",
        description: "Image generation prompt.",
        required: false,
      },
      {
        name: "count",
        type: "number",
        description: "Number of images to generate.",
        required: false,
        default: 1,
        minimum: 1,
        maximum: 8,
      },
      {
        name: "params",
        type: "json",
        description: "Additional model parameters as JSON.",
        required: false,
        hidden: true,
      },
      {
        name: "manual_images",
        type: "json",
        description:
          "JSON array of ObjectReferences to return directly, bypassing generation.",
        required: false,
        hidden: true,
      },
    ],
    outputs: [
      {
        name: "images",
        type: "image",
        repeated: true,
        description: "Generated images.",
      },
    ],
  };

  public async execute(context: NodeContext): Promise<NodeExecution> {
    // Manual bypass
    const manualImages = context.inputs.manual_images;
    if (Array.isArray(manualImages) && manualImages.length > 0) {
      const refs = manualImages.filter((v) => isObjectReference(v));
      if (refs.length > 0) {
        return this.createSuccessResult({ images: refs });
      }
    }

    const model = context.inputs.model;
    if (typeof model !== "string" || model.trim().length === 0) {
      return this.createErrorResult(
        "A model identifier is required (e.g. black-forest-labs/flux-schnell)."
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

    const count =
      typeof context.inputs.count === "number" ? context.inputs.count : 1;
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
      input: { ...input, prompt, num_outputs: count, ...extraParams },
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
      pollIntervalMs: 5000,
      timeoutMinutes: 30,
    });

    return awaitReplicateOrPending({
      context,
      continuation,
      token: REPLICATE_API_TOKEN,
      timeoutLabel: "30 minutes",
      nodeOutputs: AiImageNode.nodeType.outputs ?? [],
      createSuccessResult: (outputs, usage) =>
        this.createSuccessResult(outputs, usage),
      createErrorResult: (error, usage) => this.createErrorResult(error, usage),
    });
  }
}
