import {
  AI_AUDIO_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
} from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import { AI_AUDIO_PROMPT_HANDLE_ID } from "./ai-audio-node-utils";
import {
  buildAiAudioPromptReferenceConnectionFromCardDrop,
  evaluateAiAudioPromptReferenceStructural,
} from "./ai-audio-prompt-reference";
import { withGenerativeManualContentMode } from "./generative-card-mode-utils";
import { AI_TEXT_OUTPUT_ID } from "./ai-text-node-utils";
import { validateWorkflowConnection } from "./workflow-connection-validation";
import type { WorkflowNodeType } from "./workflow-types";

function mockTextNode(id: string) {
  return {
    id,
    data: {
      nodeType: AI_TEXT_NODE_TYPE,
      inputs: [],
      outputs: [{ id: AI_TEXT_OUTPUT_ID, type: "string", name: "text" }],
    } as WorkflowNodeType,
    position: { x: 0, y: 0 },
  };
}

function mockAudioNode(
  id: string,
  metadata?: Record<string, string>
) {
  return {
    id,
    data: {
      nodeType: AI_AUDIO_NODE_TYPE,
      metadata,
      inputs: [],
      outputs: [{ id: "audios", type: "audio", name: "audios" }],
    } as WorkflowNodeType,
    position: { x: 200, y: 0 },
  };
}

describe("ai-audio-prompt-reference", () => {
  it("rejects prompt references when the card is in manual content mode", () => {
    const metadata = withGenerativeManualContentMode(undefined);

    expect(
      evaluateAiAudioPromptReferenceStructural({
        targetNodeId: "audio-1",
        targetNodeMetadata: metadata,
        sourceNodeId: "text-1",
        sourceNodeType: AI_TEXT_NODE_TYPE,
      }).ok
    ).toBe(false);

    expect(
      buildAiAudioPromptReferenceConnectionFromCardDrop({
        dragFromNodeId: "text-1",
        dragFromHandle: { type: "source", id: AI_TEXT_OUTPUT_ID },
        hoveredNodeId: "audio-1",
        nodes: [
          { id: "text-1", data: mockTextNode("text-1").data },
          { id: "audio-1", data: mockAudioNode("audio-1", metadata).data },
        ],
      })
    ).toBeNull();
  });

  it("blocks canvas validation for text to manual audio prompt handle", () => {
    const metadata = withGenerativeManualContentMode(undefined);
    const textNode = mockTextNode("text-1");
    const audioNode = mockAudioNode("audio-1", metadata);

    expect(
      validateWorkflowConnection({
        connection: {
          source: "text-1",
          sourceHandle: AI_TEXT_OUTPUT_ID,
          target: "audio-1",
          targetHandle: AI_AUDIO_PROMPT_HANDLE_ID,
        },
        nodes: [textNode, audioNode],
        edges: [],
      })
    ).toBe(false);
  });
});
