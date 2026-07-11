import type { NodeExecution, NodeType } from "@dafthunk/types";
import { withSelectedModel } from "@dafthunk/types";

import { executeAiInterfaceSync } from "../../ai-interface/execute-sync";
import type { NodeContext } from "../../node-types";
import { ExecutableNode } from "../../node-types";

export const AI_TEXT_NODE_TYPE = "ai-text" as const;

/**
 * AI Text node — gateway-style text generation via org AI interfaces.
 * Supports manual_text bypass for testing without API calls.
 */
export class AiTextNode extends ExecutableNode {
  public static readonly nodeType: NodeType = {
    id: "ai-text",
    name: "AI Text",
    type: "ai-text",
    description:
      "Generate text using an AI model configured via your organization's AI interfaces.",
    documentation: `Generates text using the organization's configured AI interface.

### Inputs
- **prompt**: The prompt to send to the AI model.
- **model**: Optional model override.
- **manual_text**: When set, returns this text directly without calling the AI API (useful for testing).

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
        description:
          "Organization AI interface instance ID. Leave empty to use the org default.",
        required: false,
        hidden: true,
      },
      {
        name: "model",
        type: "string",
        description: "Model override (e.g. gpt-4o, claude-3-5-sonnet).",
        required: false,
      },
      {
        name: "prompt",
        type: "string",
        description: "The prompt to send to the model.",
        required: false,
      },
      {
        name: "manual_text",
        type: "string",
        description: "Return this text directly, bypassing the AI API.",
        required: false,
        hidden: true,
      },
    ],
    outputs: [{ name: "text", type: "string" }],
  };

  public async execute(context: NodeContext): Promise<NodeExecution> {
    const manualText = context.inputs.manual_text;
    if (typeof manualText === "string" && manualText.trim().length > 0) {
      return this.createSuccessResult({ text: manualText.trim() });
    }

    if (!context.resolveAiInterface) {
      return this.createErrorResult(
        "No AI interface configured. Please set up an AI interface in your organization settings."
      );
    }

    const interfaceIdRaw = context.inputs.ai_interface_id;
    const interfaceId =
      typeof interfaceIdRaw === "string" && interfaceIdRaw.trim().length > 0
        ? interfaceIdRaw.trim()
        : undefined;

    const resolved = await context.resolveAiInterface({ interfaceId });

    if (!resolved) {
      return this.createErrorResult(
        "Could not resolve an AI interface. Please configure an AI interface in your organization settings."
      );
    }

    const result = await executeAiInterfaceSync({
      resolved: withSelectedModel(resolved, context.inputs.model),
      inputs: context.inputs,
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
