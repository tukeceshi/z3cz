import type { PatchNodeLayoutMetadata } from "@dafthunk/types";
import { useCallback } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import { warmCardUploadPersist } from "@/services/generative-card-upload-persist";
import { stageGenerativeCardUpload } from "@/services/stage-generative-media";

import { withAiVideoGenerateError, withAiVideoManualUpload } from "./ai-video-node-utils";
import { useCloudStorageCanvasContext } from "./cloud-storage-canvas-provider";
import { resolveGenerativeCardUploadError } from "./generative-card-upload-utils";
import { withGenerativeUploadProgress } from "./generative-progress-utils";
import { createPatchNodeLayoutMetadata } from "./patch-node-layout-metadata";
import { prepareGenerativeCardError } from "./prepare-generative-card-error";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

type UpdateNodeDataFn = (
  nodeId: string,
  updater: (current: WorkflowNodeType) => Partial<WorkflowNodeType>
) => void;

export interface UploadVideoFileToNodeParams {
  readonly nodeId: string;
  readonly file: File;
  readonly organizationId: string;
  readonly workflowId: string;
  readonly cloudConfigured: boolean;
  readonly updateNodeData: UpdateNodeDataFn;
  readonly t: ReturnType<typeof useTranslation>["t"];
  readonly toast: ReturnType<typeof useAppToast>;
  readonly patchNodeLayout?: PatchNodeLayoutMetadata;
}

/** Single-file video upload: DB staging → node manual content → background cloud persist. */
export async function uploadVideoFileToNode(
  params: UploadVideoFileToNodeParams
): Promise<void> {
  params.updateNodeData(params.nodeId, (current) => ({
    metadata: withGenerativeUploadProgress(current.metadata, true),
  }));

  try {
    const staged = await stageGenerativeCardUpload({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      file: params.file,
      cloudConfigured: params.cloudConfigured,
      mediaKind: "ai-video",
      nodeType: "ai-video",
      patchNodeLayout: params.patchNodeLayout,
    });

    warmCardUploadPersist({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      staged,
      nodeType: "ai-video",
      cloudConfigured: params.cloudConfigured,
    });

    const uploadError = resolveGenerativeCardUploadError({
      value: staged,
      cloudConfigured: params.cloudConfigured,
      t: params.t,
    });

    params.updateNodeData(params.nodeId, (current) => {
      const withMedia = withAiVideoManualUpload(current, [staged]);
      return {
        ...withMedia,
        metadata: withGenerativeUploadProgress(
          withAiVideoGenerateError(withMedia.metadata, uploadError),
          false
        ),
      };
    });

    if (uploadError) {
      params.toast.errorRaw(uploadError.summary);
    }
  } catch (error) {
    const formatted = prepareGenerativeCardError(
      error instanceof Error ? error.message : String(error),
      params.t,
      "video"
    );
    params.updateNodeData(params.nodeId, (current) => ({
      metadata: withGenerativeUploadProgress(
        withAiVideoGenerateError(current.metadata, formatted),
        false
      ),
    }));
    params.toast.errorRaw(formatted.summary);
  }
}

export interface UseGenerativeVideoFileUploadResult {
  readonly uploadVideoFileToNode: (params: {
    readonly nodeId: string;
    readonly file: File;
    readonly patchNodeLayout?: PatchNodeLayoutMetadata;
  }) => Promise<void>;
  readonly blocksGenerativeMedia: boolean;
  readonly canUpload: boolean;
}

export function useGenerativeVideoFileUpload(): UseGenerativeVideoFileUploadResult {
  const { t } = useTranslation();
  const toast = useAppToast();
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id;
  const { configured: cloudConfigured, blocksGenerativeMedia } =
    useCloudStorageCanvasContext();
  const { updateNodeData } = useWorkflow();

  const uploadVideoFileToNodeForNode = useCallback(
    async (params: {
      readonly nodeId: string;
      readonly file: File;
      readonly patchNodeLayout?: PatchNodeLayoutMetadata;
    }) => {
      if (!updateNodeData || !orgId || !workflowId) {
        return;
      }

      const patchNodeLayout =
        params.patchNodeLayout ??
        createPatchNodeLayoutMetadata(params.nodeId, updateNodeData);

      await uploadVideoFileToNode({
        nodeId: params.nodeId,
        file: params.file,
        organizationId: orgId,
        workflowId,
        cloudConfigured,
        updateNodeData,
        t,
        toast,
        patchNodeLayout,
      });
    },
    [cloudConfigured, orgId, t, toast, updateNodeData, workflowId]
  );

  return {
    uploadVideoFileToNode: uploadVideoFileToNodeForNode,
    blocksGenerativeMedia,
    canUpload: Boolean(updateNodeData && orgId && workflowId && !blocksGenerativeMedia),
  };
}
