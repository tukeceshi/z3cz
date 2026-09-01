import { AI_VIDEO_NODE_TYPE } from "@dafthunk/types";

import { describe, expect, it, vi } from "vitest";



import { AI_VIDEO_REFERENCE_HANDLE_ID } from "./ai-video-node-utils";

import {

  buildRetakePrimaryVideoMediaKey,

  syncRetakePrimaryVideoDraft,

} from "./sync-retake-primary-video";

import type { WorkflowNodeType } from "./workflow-types";



vi.mock("./video-trim-utils", () => ({

  resolveRetakeVideoDurationSec: vi.fn(),

  resolveRetakeVideoDimensions: vi.fn(),

  resolveTrimSourceVideoUrl: vi.fn(),

}));



import {

  resolveRetakeVideoDimensions,

  resolveRetakeVideoDurationSec,

  resolveTrimSourceVideoUrl,

} from "./video-trim-utils";



const sourceVideo: WorkflowNodeType = {

  name: "Source",

  nodeType: AI_VIDEO_NODE_TYPE,

  icon: "video",

  inputs: [],

  outputs: [

    {

      id: "videos",

      name: "videos",

      type: "json",

      value: [

        {

          kind: "cloud",

          resourceId: "res-source",

          mimeType: "video/mp4",

        },

      ],

    },

  ],

  executionState: "idle",

  createObjectUrl: () => "blob:source",

};



const retakeInputs = [

  {

    id: "retake_draft",

    name: "retake_draft",

    type: "json" as const,

    hidden: true,

    value: {

      committedRange: { startSec: 0, endSec: 10.08 },

      draftRange: { startSec: 0, endSec: 10.08 },

      loadPhase: "loading",

      cardPreview: "source",

      primaryVideoEdgeId: "edge-primary",

      primaryVideoMediaKey: null,

      highQuality: false,

      playbackPaused: false,

      selectedModelOptionId: null,

      generationParams: {},

      resolutionManuallySet: false,

      videoDurationSec: null,

      sourceVideoWidth: null,

      sourceVideoHeight: null,

    },

  },

];



const nodes = [

  { id: "source", data: sourceVideo },

  {

    id: "retake",

    data: {

      name: "Retake",

      nodeType: AI_VIDEO_NODE_TYPE,

      icon: "video",

      inputs: retakeInputs,

      outputs: [{ id: "videos", name: "videos", type: "json" }],

      executionState: "idle",

      createObjectUrl: () => "blob:retake",

      metadata: {

        aiVideoPanel: JSON.stringify({ kind: "retake" }),

      },

    } satisfies WorkflowNodeType,

  },

];



const edges = [

  {

    id: "edge-primary",

    source: "source",

    target: "retake",

    sourceHandle: "videos",

    targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,

  },

];



describe("buildRetakePrimaryVideoMediaKey", () => {

  it("combines edge id and resource id", () => {

    expect(

      buildRetakePrimaryVideoMediaKey({

        edgeId: "edge-primary",

        media: {

          kind: "cloud",

          resourceId: "res-source",

          mimeType: "video/mp4",

        },

      })

    ).toBe("edge-primary:res-source");

  });

});



describe("syncRetakePrimaryVideoDraft", () => {

  it("probes primary reference and clamps trim ranges to full duration", async () => {

    vi.mocked(resolveRetakeVideoDurationSec).mockResolvedValue(29.77);

    vi.mocked(resolveRetakeVideoDimensions).mockResolvedValue({

      width: 1920,

      height: 1080,

    });

    vi.mocked(resolveTrimSourceVideoUrl).mockResolvedValue(

      "blob:http://localhost/video"

    );



    const { patch, playbackUrl } = await syncRetakePrimaryVideoDraft({

      targetNodeId: "retake",

      edges,

      nodes,

      inputs: retakeInputs,

      organizationId: "org-1",

      workflowId: "wf-1",

      currentDraft: retakeInputs[0].value as never,

    });



    expect(patch.loadPhase).toBe("ready");

    expect(patch.videoDurationSec).toBe(29.77);

    expect(patch.committedRange).toEqual({ startSec: 0, endSec: 10.08 });

    expect(patch.draftRange).toEqual({ startSec: 0, endSec: 10.08 });

    expect(patch.primaryVideoMediaKey).toBe("edge-primary:res-source");

    expect(playbackUrl).toBe("blob:http://localhost/video");

    expect("trimSourceVideoUrl" in patch).toBe(false);

    expect(resolveRetakeVideoDurationSec).toHaveBeenCalledWith(

      expect.objectContaining({

        organizationId: "org-1",

        workflowId: "wf-1",

      })

    );

    expect(resolveRetakeVideoDurationSec).toHaveBeenCalledWith(

      expect.not.objectContaining({ knownDurationSec: expect.anything() })

    );

  });



  it("returns error patch when primary reference is missing", async () => {

    const { patch, playbackUrl } = await syncRetakePrimaryVideoDraft({

      targetNodeId: "retake",

      edges: [],

      nodes,

      inputs: retakeInputs,

      organizationId: "org-1",

      workflowId: "wf-1",

      currentDraft: retakeInputs[0].value as never,

    });



    expect(patch.loadPhase).toBe("error");

    expect(patch.videoDurationSec).toBeNull();

    expect(playbackUrl).toBeNull();

  });



  it("returns error patch when probe fails", async () => {

    vi.mocked(resolveRetakeVideoDurationSec).mockResolvedValue(null);

    vi.mocked(resolveRetakeVideoDimensions).mockResolvedValue(null);

    vi.mocked(resolveTrimSourceVideoUrl).mockResolvedValue(null);



    const { patch, playbackUrl } = await syncRetakePrimaryVideoDraft({

      targetNodeId: "retake",

      edges,

      nodes,

      inputs: retakeInputs,

      organizationId: "org-1",

      workflowId: "wf-1",

      currentDraft: retakeInputs[0].value as never,

    });



    expect(patch.loadPhase).toBe("error");

    expect(patch.primaryVideoEdgeId).toBe("edge-primary");

    expect(playbackUrl).toBeNull();

  });

});


