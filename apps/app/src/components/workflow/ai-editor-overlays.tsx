import { AI_GENERATIVE_NODE_TYPES } from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useOrgCloudStorageStatus } from "@/services/platform-ai-model-service";

import { AiCloudStorageBanner } from "./ai-cloud-storage-banner";
import { AiMediaCacheBar } from "./ai-media-cache-panel";
import type { WorkflowNodeType } from "./workflow-types";

interface AiEditorOverlaysProps {
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
}

export function AiEditorOverlays({ nodes }: AiEditorOverlaysProps) {
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id;
  const { configured, isLoading } = useOrgCloudStorageStatus(orgId);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const hasGenerativeNodes = useMemo(
    () =>
      nodes.some((node) =>
        AI_GENERATIVE_NODE_TYPES.includes(
          node.data.nodeType as (typeof AI_GENERATIVE_NODE_TYPES)[number]
        )
      ),
    [nodes]
  );

  const showBanner =
    hasGenerativeNodes && !isLoading && !configured && !bannerDismissed;

  if (!orgId) return null;

  return (
    <>
      <AiCloudStorageBanner
        visible={showBanner}
        onDismiss={() => setBannerDismissed(true)}
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
