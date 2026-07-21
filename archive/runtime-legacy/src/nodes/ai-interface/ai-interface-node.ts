import type { NodeExecution, NodeType } from "@dafthunk/types";
import { AI_INTERFACE_NODE_TYPE } from "@dafthunk/types";

import type { NodeContext } from "@dafthunk/runtime";
import { ExecutableNode } from "@dafthunk/runtime";

/**
 * Legacy template-as-node implementation.
 * Kept registered so old graphs still resolve the type; new catalogs omit it.
 * Execution directs users to the platform-model `ai-text` node.
 */
export class AiInterfaceNode extends ExecutableNode {
  public static readonly nodeType: NodeType = {
    id: "ai-interface",
    name: "AI Interface",
    type: AI_INTERFACE_NODE_TYPE,
    description:
      "Deprecated. Use the AI Text node with platform AI models instead.",
    documentation:
      "This node type is no longer available in the palette. Replace it with an AI Text (`ai-text`) node and select a platform model. Configure upstream credentials under Organization → AI & Resource APIs.",
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

  public async execute(_context: NodeContext): Promise<NodeExecution> {
    return this.createErrorResult(
      "The AI Interface canvas node is deprecated. Replace it with an AI Text (ai-text) node and select a platform model. Upstream credentials remain under Organization → AI & Resource APIs."
    );
  }
}
