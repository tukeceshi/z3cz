import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";

import { AiCloudStorageBanner } from "./ai-cloud-storage-banner";
import { AiMediaCacheBar } from "./ai-media-cache-panel";
import { useCloudStorageCanvasContext } from "./cloud-storage-canvas-provider";
import type { WorkflowNodeType } from "./workflow-types";

interface AiEditorOverlaysProps {
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
}

export function AiEditorOverlays({ nodes }: AiEditorOverlaysProps) {
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id;
  const {
    configured,
    blocksGenerativeMedia,
    health,
    isLoading,
    autoFixState,
  } = useCloudStorageCanvasContext();
  const [notConfiguredDismissed, setNotConfiguredDismissed] = useState(false);
  const [degradedDismissed, setDegradedDismissed] = useState(false);
  const [unhealthyDismissed, setUnhealthyDismissed] = useState(false);

  const hasGenerativeMediaNodes = useMemo(() => {
    const mediaNodeTypes: readonly string[] = [
      AI_AUDIO_NODE_TYPE,
      AI_IMAGE_NODE_TYPE,
      AI_VIDEO_NODE_TYPE,
    ];
    return nodes.some((node) =>
      mediaNodeTypes.includes(node.data.nodeType ?? "")
    );
  }, [nodes]);

  const showNotConfiguredBanner =
    hasGenerativeMediaNodes &&
    !isLoading &&
    !configured &&
    !notConfiguredDismissed;

  const showAutoFixingBanner =
    hasGenerativeMediaNodes && autoFixState === "fixing_cors";

  const showDegradedBanner =
    hasGenerativeMediaNodes &&
    !isLoading &&
    configured &&
    health?.status === "degraded" &&
    !blocksGenerativeMedia &&
    !degradedDismissed &&
    !showAutoFixingBanner;

  const showUnhealthyBanner =
    hasGenerativeMediaNodes &&
    !isLoading &&
    configured &&
    blocksGenerativeMedia &&
    !unhealthyDismissed &&
    autoFixState !== "fixing_cors";

  if (!orgId) return null;

  return (
    <>
      <AiCloudStorageBanner
        visible={showNotConfiguredBanner}
        variant="not_configured"
        onDismiss={() => setNotConfiguredDismissed(true)}
      />
      <AiCloudStorageBanner
        visible={showAutoFixingBanner}
        variant="auto_fixing"
        showConfigureAction={false}
      />
      <AiCloudStorageBanner
        visible={showDegradedBanner}
        variant="degraded"
        onDismiss={() => setDegradedDismissed(true)}
      />
      <AiCloudStorageBanner
        visible={showUnhealthyBanner}
        variant="unhealthy"
        reason={health?.reason}
        onDismiss={() => setUnhealthyDismissed(true)}
      />
      <div className="absolute bottom-16 left-4 z-50 flex flex-col items-start gap-2">
        <AiMediaCacheBar
          organizationId={orgId}
          currentWorkflowId={workflowId}
        />
      </div>
    </>
  );
}
