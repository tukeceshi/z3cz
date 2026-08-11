import type { Node as ReactFlowNode } from "@xyflow/react";

import type { WorkflowNodeType } from "@/components/workflow/workflow-types";

import { useCloudStorageCanvasContext } from "./cloud-storage-canvas-provider";
import { useMigrateInlineAiText } from "./use-migrate-inline-ai-text";

interface InlineAiTextMigrationHostProps {
  readonly organizationId: string | undefined;
  readonly workflowId: string | undefined;
  readonly graphReady: boolean;
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly setNodes: React.Dispatch<
    React.SetStateAction<ReactFlowNode<WorkflowNodeType>[]>
  >;
}

/** Runs lazy inline ai-text → staged migration once the canvas is ready. */
export function InlineAiTextMigrationHost(
  props: InlineAiTextMigrationHostProps
): null {
  const { configured: cloudConfigured } = useCloudStorageCanvasContext();

  useMigrateInlineAiText({
    ...props,
    cloudConfigured,
  });

  return null;
}
