import type { NodeExecution, NodeType } from "@dafthunk/types";
import {
  buildAiTextUserPrompt,
  normalizeAiTextReferences,
  withSelectedModel,
} from "@dafthunk/types";

import { executeAiInterfaceSync } from "../../ai-interface/execute-sync";
import type { NodeContext } from "../../node-types";
import { ExecutableNode } from "../../node-types";

export const AI_TEXT_NODE_TYPE = "ai-text" as const;
export const AI_TEXT_KEYWORDS_INPUT = "keywords" as const;

/**
 * AI Text node — generates text via org AI interfaces and platform model catalog.
 */
export class AiTextNode extends ExecutableNode {
  public static readonly nodeType: NodeType = {
    id: "ai-text",
    name: "Text",
    type: "ai-text",
    description:
      "Generate text using an AI model configured via your organization's AI interfaces.",
    documentation: `Generates text using the organization's configured AI interface.

### Inputs
- **keywords**: Optional upstream text reference (wired on the canvas).
- **prompt**: Manual prompt when keywords is not connected.
- **model**: Platform model canonical id (e.g. deepseek-v4-flash).

### Outputs
- **text**: The generated text response.`,
    tags: ["newai"],
    icon: "type",
    inlinable: false,
    usage: 1,
    inputs: [
      {
        name: "ai_interface_id",
        type: "string",
        description: "Resolved automatically from the selected model.",
        required: false,
        hidden: true,
      },
      {
        name: "model",
        type: "string",
        description: "Platform model canonical id.",
        required: false,
        hidden: true,
      },
      {
        name: "result",
        type: "string",
        description:
          "Last generated text shown on the canvas card (persisted with the workflow).",
        required: false,
        hidden: true,
      },
      {
        name: AI_TEXT_KEYWORDS_INPUT,
        type: "any",
        description: "Upstream references (text / image / video per model limits).",
        required: false,
        hidden: true,
        repeated: true,
      },
      {
        name: "result_history",
        type: "json",
        description: "Candidate generation results for history picker.",
        required: false,
        hidden: true,
      },
      {
        name: "prompt",
        type: "string",
        description: "Manual instruction; combined with connected keywords when present.",
        required: false,
        hidden: true,
      },
    ],
    outputs: [{ name: "text", type: "string" }],
  };

  public async execute(context: NodeContext): Promise<NodeExecution> {
    const references = normalizeAiTextReferences(
      context.inputs[AI_TEXT_KEYWORDS_INPUT]
    );
    const question =
      typeof context.inputs.prompt === "string"
        ? context.inputs.prompt.trim()
        : "";
    const effectivePrompt = buildAiTextUserPrompt({ references, question });

    if (!effectivePrompt) {
      return this.createErrorResult(
        "A prompt or connected keywords input is required."
      );
    }

    if (!context.resolveAiInterface) {
      return this.createErrorResult(
        "No AI interface configured. Please set up an AI interface in your organization settings."
      );
    }

    const modelCanonicalId =
      typeof context.inputs.model === "string" &&
      context.inputs.model.trim().length > 0
        ? context.inputs.model.trim()
        : undefined;

    let interfaceId =
      typeof context.inputs.ai_interface_id === "string" &&
      context.inputs.ai_interface_id.trim().length > 0
        ? context.inputs.ai_interface_id.trim()
        : undefined;

    let providerModelId: string | undefined;

    if (modelCanonicalId) {
      if (!context.resolveTextModel) {
        return this.createErrorResult(
          "Text model resolution is unavailable in this runtime."
        );
      }

      const resolvedModel = await context.resolveTextModel(modelCanonicalId);
      if (!resolvedModel) {
        return this.createErrorResult(
          `Model "${modelCanonicalId}" is not available for this organization.`
        );
      }

      interfaceId = resolvedModel.interfaceId;
      providerModelId = resolvedModel.providerModelId;
    }

    const resolved = await context.resolveAiInterface({ interfaceId });

    if (!resolved) {
      return this.createErrorResult(
        "Could not resolve an AI interface. Please configure an AI interface in your organization settings."
      );
    }

    const selected = withSelectedModel(resolved, providerModelId);

    const result = await executeAiInterfaceSync({
      resolved: selected,
      inputs: {
        ...context.inputs,
        prompt: effectivePrompt,
      },
    });

    if (result.status === "failed") {
      return this.createErrorResult(
        result.error ?? "AI interface request failed"
      );
    }

    const text =
      result.outputs?.text ?? result.outputs?.content ?? result.outputs?.result;

    return this.createSuccessResult(
      { text: typeof text === "string" ? text : JSON.stringify(text) },
      result.usage ?? 1
    );
  }
}
