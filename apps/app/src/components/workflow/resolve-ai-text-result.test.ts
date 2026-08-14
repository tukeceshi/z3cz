import { describe, expect, it } from "vitest";



import {

  AI_TEXT_BODY_OUTPUT_ID,

  AI_TEXT_OUTPUT_ID,

  AI_TEXT_RESULT_INPUT_ID,

  readAiTextResultTextSync,

} from "./ai-text-node-utils";

import {

  isUpstreamAiTextPendingLoad,

  readAiTextResultExcerptSync,

  resolveAiTextReferenceInputsFromChips,

  resolveReferencedAiTextFromEdges,

} from "./resolve-ai-text-result";

import type { WorkflowNodeType } from "./workflow-types";



function createTextNode(

  overrides?: Partial<WorkflowNodeType>

): WorkflowNodeType {

  return {

    id: "node-1",

    type: "workflowNode",

    name: "AI Text",

    nodeType: "ai-text",

    position: { x: 0, y: 0 },

    inputs: [],

    outputs: [

      { id: AI_TEXT_OUTPUT_ID, name: "text", type: "string", value: "" },

      { id: AI_TEXT_BODY_OUTPUT_ID, name: "textBody", type: "string", value: "" },

    ],

    metadata: undefined,

    ...overrides,

  };

}



describe("resolve-ai-text-result", () => {

  it("reads full body from textBody and ignores the generation prompt input", () => {

    const node = createTextNode({

      inputs: [

        { id: "prompt", name: "prompt", type: "string", value: "generate me a poem" },

        {

          id: AI_TEXT_RESULT_INPUT_ID,

          name: AI_TEXT_RESULT_INPUT_ID,

          type: "json",

          value: {

            resourceId: "res-1",

            contentSha256: "abc",

            mimeType: "text/plain; charset=utf-8",

          },

        },

      ],

      outputs: [

        {

          id: AI_TEXT_OUTPUT_ID,

          name: "text",

          type: "string",

          value: "short preview",

        },

        {

          id: AI_TEXT_BODY_OUTPUT_ID,

          name: "textBody",

          type: "string",

          value: "  final poem  ",

        },

      ],

    });



    expect(readAiTextResultTextSync(node)).toBe("final poem");

    expect(readAiTextResultExcerptSync(node)).toBe("short preview");

  });



  it("marks stored bodies without session output as pending", () => {

    const node = createTextNode({

      inputs: [

        {

          id: AI_TEXT_RESULT_INPUT_ID,

          name: AI_TEXT_RESULT_INPUT_ID,

          type: "json",

          value: {

            resourceId: "res-1",

            contentSha256: "abc",

            mimeType: "text/plain; charset=utf-8",

          },

        },

      ],

    });



    expect(isUpstreamAiTextPendingLoad(node)).toBe(true);

    expect(readAiTextResultTextSync(node)).toBe("");

  });



  it("resolves referenced prompt from mirrored textBody only", () => {

    const source = createTextNode({

      id: "text-source",

      outputs: [

        {

          id: AI_TEXT_OUTPUT_ID,

          name: "text",

          type: "string",

          value: "preview",

        },

        {

          id: AI_TEXT_BODY_OUTPUT_ID,

          name: "textBody",

          type: "string",

          value: "mirrored body",

        },

      ],

    });



    const text = resolveReferencedAiTextFromEdges({

      nodeId: "image-1",

      targetHandle: "prompt_reference",

      edges: [

        {

          source: "text-source",

          target: "image-1",

          targetHandle: "prompt_reference",

        },

      ],

      nodes: [{ id: "text-source", data: source }],

    });



    expect(text).toBe("mirrored body");

  });



  it("builds keyword references from chips without fetching", () => {

    const source = createTextNode({

      id: "text-source",

      outputs: [

        {

          id: AI_TEXT_OUTPUT_ID,

          name: "text",

          type: "string",

          value: "preview",

        },

        {

          id: AI_TEXT_BODY_OUTPUT_ID,

          name: "textBody",

          type: "string",

          value: "keyword body",

        },

      ],

    });



    const refs = resolveAiTextReferenceInputsFromChips({

      chips: [

        {

          edgeId: "e1",

          sourceNodeId: "text-source",

          kind: "text",

          label: "Text 1",

        },

      ],

      nodes: [{ id: "text-source", data: source }],

    });



    expect(refs).toEqual([{ name: "Text 1", content: "keyword body" }]);

  });

});

