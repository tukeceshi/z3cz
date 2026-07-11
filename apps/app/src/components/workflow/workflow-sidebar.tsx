import type {
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
} from "@xyflow/react";
import Users from "lucide-react/icons/users";

import { useTranslation } from "@/components/locale-provider";

import { WorkflowEdgeInspector } from "./workflow-edge-inspector";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export interface WorkflowSidebarProps {
  selectedNodes: ReactFlowNode<WorkflowNodeType>[];
  selectedEdges: ReactFlowEdge<WorkflowEdgeType>[];
  onEdgeUpdate?: (edgeId: string, data: Partial<WorkflowEdgeType>) => void;
  disabledWorkflow?: boolean;
}

function AgentPlaceholder() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <h2 className="text-base font-semibold text-foreground">
        {t("workflow.sidebar.agentTitle")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t("workflow.sidebar.agentDescription")}
      </p>
    </div>
  );
}

export function WorkflowSidebar({
  selectedNodes,
  selectedEdges,
  onEdgeUpdate,
  disabledWorkflow = false,
}: WorkflowSidebarProps) {
  const { t } = useTranslation();
  const totalSelected = selectedNodes.length + selectedEdges.length;
  const singleSelectedNode =
    selectedNodes.length === 1 ? selectedNodes[0] : null;
  const singleSelectedEdge =
    selectedEdges.length === 1 ? selectedEdges[0] : null;

  return (
    <div className="h-full overflow-y-auto border-s bg-neutral-50 dark:bg-neutral-800">
      {singleSelectedNode && totalSelected === 1 ? <AgentPlaceholder /> : null}
      {singleSelectedEdge && totalSelected === 1 ? (
        <WorkflowEdgeInspector
          edge={singleSelectedEdge}
          onEdgeUpdate={onEdgeUpdate}
          disabled={disabledWorkflow}
        />
      ) : null}
      {totalSelected === 0 ? <AgentPlaceholder /> : null}
      {totalSelected > 1 ? (
        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
          <Users className="mb-4 h-12 w-12 text-blue-400 dark:text-blue-500" />
          <h3 className="mb-2 text-lg font-medium text-neutral-900 dark:text-neutral-100">
            {t("workflow.sidebar.multipleSelected")}
          </h3>
          <p className="mb-4 text-neutral-500">
            {selectedNodes.length > 0 && selectedEdges.length > 0
              ? t("workflow.sidebar.nodesAndEdges", {
                  nodeCount: selectedNodes.length,
                  edgeCount: selectedEdges.length,
                })
              : selectedNodes.length > 0
                ? t("workflow.sidebar.nodesSelected", {
                    count: selectedNodes.length,
                  })
                : t("workflow.sidebar.edgesSelected", {
                    count: selectedEdges.length,
                  })}
          </p>
          <p className="text-sm text-neutral-400">
            {t("workflow.sidebar.selectSingleHint")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
