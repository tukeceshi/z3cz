import {

  clampVideoRetakeTrimRange,

  getResourceIdFromValue,

  type AiVideoRetakeDraft,

  type WorkflowMediaValue,

} from "@dafthunk/types";

import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";



import { resolveRetakePrimaryVideoRef } from "./ai-video-retake-primary-ref";

import {

  resolveRetakeVideoDimensions,

  resolveRetakeVideoDurationSec,

  resolveTrimSourceVideoUrl,

} from "./video-trim-utils";

import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";



type FlowEdgeRef = Pick<

  ReactFlowEdge<WorkflowEdgeType>,

  "id" | "source" | "target" | "sourceHandle" | "targetHandle"

>;



type FlowNodeRef = Pick<ReactFlowNode<WorkflowNodeType>, "id" | "data">;



export function buildRetakePrimaryVideoMediaKey(params: {

  readonly edgeId: string;

  readonly media: WorkflowMediaValue;

}): string {

  const resourceId = getResourceIdFromValue(params.media);

  if (resourceId) {

    return `${params.edgeId}:${resourceId}`;

  }

  return params.edgeId;

}



export interface SyncRetakePrimaryVideoResult {

  readonly patch: Partial<AiVideoRetakeDraft>;

  readonly playbackUrl: string | null;

}



export async function syncRetakePrimaryVideoDraft(params: {

  readonly targetNodeId: string;

  readonly edges: readonly FlowEdgeRef[];

  readonly nodes: readonly FlowNodeRef[];

  readonly inputs: readonly { readonly id: string; readonly value?: unknown }[];

  readonly organizationId: string;

  readonly workflowId: string;

  readonly currentDraft: AiVideoRetakeDraft;

}): Promise<SyncRetakePrimaryVideoResult> {

  const primary = resolveRetakePrimaryVideoRef({

    targetNodeId: params.targetNodeId,

    edges: params.edges,

    nodes: params.nodes,

    draft: params.currentDraft,

    inputs: params.inputs,

  });



  if (!primary) {

    return {

      patch: {

        loadPhase: "error",

        videoDurationSec: null,

        sourceVideoWidth: null,

        sourceVideoHeight: null,

        primaryVideoMediaKey: null,

      },

      playbackUrl: null,

    };

  }



  const mediaKey = buildRetakePrimaryVideoMediaKey({

    edgeId: primary.edgeId,

    media: primary.media,

  });



  const [videoDurationSec, dimensions, playbackUrl] = await Promise.all([

    resolveRetakeVideoDurationSec({

      media: primary.media,

      organizationId: params.organizationId,

      workflowId: params.workflowId,

    }),

    resolveRetakeVideoDimensions({

      media: primary.media,

      organizationId: params.organizationId,

      workflowId: params.workflowId,

    }),

    resolveTrimSourceVideoUrl({

      media: primary.media,

      organizationId: params.organizationId,

      workflowId: params.workflowId,

    }),

  ]);



  if (

    videoDurationSec === null ||

    !Number.isFinite(videoDurationSec) ||

    videoDurationSec <= 0 ||

    !playbackUrl

  ) {

    return {

      patch: {

        loadPhase: "error",

        primaryVideoEdgeId: primary.edgeId,

        primaryVideoMediaKey: mediaKey,

        videoDurationSec: null,

        sourceVideoWidth: null,

        sourceVideoHeight: null,

      },

      playbackUrl: null,

    };

  }



  const committedRange = clampVideoRetakeTrimRange(

    params.currentDraft.committedRange,

    videoDurationSec

  );

  const draftRange = clampVideoRetakeTrimRange(

    params.currentDraft.draftRange,

    videoDurationSec

  );



  const sourceVideoWidth = dimensions?.width ?? null;

  const sourceVideoHeight = dimensions?.height ?? null;



  return {

    patch: {

      primaryVideoEdgeId: primary.edgeId,

      primaryVideoMediaKey: mediaKey,

      videoDurationSec,

      sourceVideoWidth,

      sourceVideoHeight,

      loadPhase: "ready",

      committedRange,

      draftRange,

    },

    playbackUrl,

  };

}


