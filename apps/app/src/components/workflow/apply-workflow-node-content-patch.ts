import type { WorkflowNodeContentPatch } from "@dafthunk/types";

import type { WorkflowNodeType, WorkflowParameter } from "./workflow-types";

function upsertInputFromPatch(
  inputs: readonly WorkflowParameter[],
  id: string,
  value: unknown
): WorkflowParameter[] {
  if (inputs.some((input) => input.id === id)) {
    return inputs.map((input) =>
      input.id === id ? ({ ...input, value } as WorkflowParameter) : input
    );
  }

  return [
    ...inputs,
    {
      id,
      name: id,
      type: "json",
      hidden: true,
      value,
    } as WorkflowParameter,
  ];
}

function upsertOutputFromPatch(
  outputs: readonly WorkflowParameter[],
  id: string,
  value: unknown
): WorkflowParameter[] {
  if (outputs.some((output) => output.id === id)) {
    return outputs.map((output) =>
      output.id === id ? ({ ...output, value } as WorkflowParameter) : output
    );
  }

  return [
    ...outputs,
    {
      id,
      name: id,
      type: "json",
      hidden: true,
      value,
    } as WorkflowParameter,
  ];
}

export function applyWorkflowNodeContentPatch(
  current: WorkflowNodeType,
  patch: WorkflowNodeContentPatch
): Partial<WorkflowNodeType> {
  let inputs = [...current.inputs];
  let outputs = [...current.outputs];

  if (patch.inputs) {
    for (const [name, value] of Object.entries(patch.inputs)) {
      inputs = upsertInputFromPatch(inputs, name, value);
    }
  }

  if (patch.outputs) {
    for (const [name, value] of Object.entries(patch.outputs)) {
      outputs = upsertOutputFromPatch(outputs, name, value);
    }
  }

  return {
    inputs,
    outputs,
    ...(patch.metadata
      ? {
          metadata: {
            ...(current.metadata ?? {}),
            ...patch.metadata,
          },
        }
      : {}),
  };
}
