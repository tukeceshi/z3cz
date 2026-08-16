import type { Node, NodeType, WorkflowTrigger } from "@dafthunk/types";

/**
 * New workflows no longer auto-insert trigger nodes.
 * Keep legacy type IDs so old graphs still recognize trigger nodes
 * (delete guards) without mapping them onto the canvas.
 */
const TRIGGER_TO_NODE_TYPES: Record<WorkflowTrigger, string[]> = {
  manual: [],
  http_request: [],
  scheduled: [],
  http_webhook: [],
  form_webhook: [],
  form_request: [],
  email_message: [],
  queue_message: [],
  discord_event: [],
  telegram_event: [],
  whatsapp_event: [],
  slack_event: [],
};

const LEGACY_TRIGGER_NODE_TYPE_IDS = [
  "receive-scheduled-trigger",
  "http-webhook",
  "form-webhook",
  "form-request",
  "form-response",
  "queue-message",
  "receive-email",
  "receive-discord-message",
  "receive-telegram-message",
  "receive-whatsapp-message",
  "receive-slack-message",
] as const;

/** All node type IDs that are trigger nodes. */
export const ALL_TRIGGER_NODE_TYPE_IDS = new Set<string>(
  LEGACY_TRIGGER_NODE_TYPE_IDS
);

/** Returns the node type IDs to add for a given trigger type. */
export function getTriggerNodeTypes(trigger: WorkflowTrigger): string[] {
  return TRIGGER_TO_NODE_TYPES[trigger] ?? [];
}

/**
 * Builds initial `Node` objects for a given trigger type, using `NodeType`
 * definitions for inputs/outputs. Used when creating workflows.
 */
export function buildInitialTriggerNodes(
  trigger: WorkflowTrigger,
  nodeTypes: NodeType[]
): Node[] {
  const nodeTypeIds = getTriggerNodeTypes(trigger);
  const nodes: Node[] = [];

  for (let i = 0; i < nodeTypeIds.length; i++) {
    const nodeTypeId = nodeTypeIds[i];
    const nodeType = nodeTypes.find((nt) => nt.type === nodeTypeId);
    if (!nodeType) continue;

    nodes.push({
      id: `${nodeType.type}-${Date.now()}-${i}`,
      name: nodeType.name,
      type: nodeType.type,
      icon: nodeType.icon,
      position: { x: i * 400, y: 0 },
      inputs: nodeType.inputs.map((p) => ({ ...p })),
      outputs: nodeType.outputs.map((p) => ({ ...p })),
      functionCalling: nodeType.functionCalling,
    });
  }

  return nodes;
}
