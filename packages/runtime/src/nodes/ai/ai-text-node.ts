import type { NodeExecution, NodeType } from "@dafthunk/types";
import {
  buildAiTextUserPrompt,
  normalizeAiTextReferences,
} from "@dafthunk/types";

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

    const modelCanonicalId =
      typeof context.inputs.model === "string" &&
      context.inputs.model.trim().length > 0
        ? context.inputs.model.trim()
        : undefined;

    if (!modelCanonicalId) {
      return this.createErrorResult("A platform model must be selected.");
    }

    if (!context.executeTextModel) {
      return this.createErrorResult(
        "Text model execution is unavailable in this runtime."
      );
    }

    const result = await context.executeTextModel({
      canonicalId: modelCanonicalId,
      effectivePrompt,
    });

    if (!result.ok || !result.text) {
      return this.createErrorResult(result.error ?? "AI text generation failed.");
    }

    return this.createSuccessResult({ text: result.text }, 1);
  }
}
