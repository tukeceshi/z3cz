import { AI_GENERATIVE_NODE_TYPES } from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useGenerativeMediaBeforeUnloadGuard } from "@/hooks/use-generative-media-before-unload";

import { AiCloudStorageBanner } from "./ai-cloud-storage-banner";
import { AiMediaCacheBar } from "./ai-media-cache-panel";
import { useCloudStorageCanvasContext } from "./cloud-storage-canvas-provider";
import type { WorkflowNodeType } from "./workflow-types";

interface AiEditorOverlaysProps {
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
}

export function AiEditorOverlays({ nodes }: AiEditorOverlaysProps) {
  useGenerativeMediaBeforeUnloadGuard();
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

  const hasGenerativeNodes = useMemo(
    () =>
      nodes.some((node) =>
        AI_GENERATIVE_NODE_TYPES.includes(
          node.data.nodeType as (typeof AI_GENERATIVE_NODE_TYPES)[number]
        )
      ),
    [nodes]
  );

  const showAutoFixingBanner =
    hasGenerativeNodes && autoFixState === "fixing_cors";

  const showNotConfiguredBanner =
    hasGenerativeNodes &&
    !isLoading &&
    !configured &&
    !notConfiguredDismissed &&
    !showAutoFixingBanner;

  const showDegradedBanner =
    hasGenerativeNodes &&
    !isLoading &&
    configured &&
    health?.status === "degraded" &&
    !blocksGenerativeMedia &&
    !degradedDismissed &&
    !showAutoFixingBanner;

  const showUnhealthyBanner =
    hasGenerativeNodes &&
    !isLoading &&
    configured &&
    blocksGenerativeMedia &&
    !unhealthyDismissed &&
    autoFixState !== "fixing_cors";

  if (!orgId) return null;

  return (
    <>
      <AiCloudStorageBanner
        visible={showAutoFixingBanner}
        variant="auto_fixing"
        showConfigureAction={false}
      />
      <AiCloudStorageBanner
        visible={showNotConfiguredBanner}
        variant="not_configured"
        onDismiss={() => setNotConfiguredDismissed(true)}
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
