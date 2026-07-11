import type {
  NodeExecution,
  NodeType,
} from "@dafthunk/types";
import { AI_INTERFACE_NODE_TYPE, withSelectedModel } from "@dafthunk/types";

import { executeAiInterfaceSync } from "../../ai-interface/execute-sync";
import type { NodeContext } from "../../node-types";
import { ExecutableNode } from "../../node-types";

export class AiInterfaceNode extends ExecutableNode {
  public static readonly nodeType: NodeType = {
    id: "ai-interface",
    name: "AI Interface",
    type: AI_INTERFACE_NODE_TYPE,
    description:
      "Run a configured AI interface template using organization credentials.",
    documentation:
      "Executes a platform AI interface template compiled from Admin settings. Provide an organization AI interface instance or rely on the org default for the template provider.",
    tags: ["AI", "LLM"],
    icon: "bot",
    inlinable: false,
    usage: 0,
    inputs: [
      {
        name: "ai_interface_id",
        type: "string",
        description:
          "Organization AI interface instance ID. Leave empty to use the org default for this template.",
        required: false,
        hidden: true,
      },
      {
        name: "model",
        type: "string",
        description: "Model override",
        required: false,
      },
      {
        name: "prompt",
        type: "string",
        description: "User prompt",
        required: true,
      },
    ],
    outputs: [{ name: "text", type: "string" }],
  };

  public async execute(context: NodeContext): Promise<NodeExecution> {
    if (!context.resolveAiInterface) {
      return this.createErrorResult("AI interface resolver is not configured");
    }

    const interfaceIdRaw = context.inputs.ai_interface_id;
    const interfaceId =
      typeof interfaceIdRaw === "string" && interfaceIdRaw.trim().length > 0
        ? interfaceIdRaw.trim()
        : undefined;

    const templateId =
      typeof this.node.metadata?.aiInterfaceTemplateId === "string"
        ? this.node.metadata.aiInterfaceTemplateId
        : undefined;

    if (!interfaceId && !templateId) {
      return this.createErrorResult(
        "ai_interface_id or template metadata is required"
      );
    }

    const resolved = await context.resolveAiInterface({
      interfaceId,
      templateId,
    });

    if (!resolved) {
      return this.createErrorResult("AI interface could not be resolved");
    }

    const result = await executeAiInterfaceSync({
      resolved: withSelectedModel(resolved, context.inputs.model),
      inputs: context.inputs,
    });

    if (result.status === "failed") {
      return this.createErrorResult(result.error ?? "AI interface request failed");
    }

    return this.createSuccessResult(result.outputs ?? {}, result.usage ?? 1);
  }
}
