import type { ReactNode } from "react";
import { Panel } from "@xyflow/react";

interface WorkflowFlowAttributionProps {
  readonly aiMediaCache?: ReactNode;
}

export function WorkflowFlowAttribution({
  aiMediaCache,
}: WorkflowFlowAttributionProps) {
  return (
    <Panel position="bottom-right" className="workflow-flow-bottom-right">
      {aiMediaCache}
      <span className="workflow-flow-attribution">React Flow</span>
    </Panel>
  );
}