import type { UpstreamParamProfileField } from "@dafthunk/types";
import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkflowParameter } from "./workflow-types";
import { useGenerativeParamsEditor } from "./use-generative-params-editor";

const FIELDS = [
  {
    name: "ratio",
    apiName: "ratio",
    description: "",
    type: "string" as const,
    enumValues: ["1:1", "16:9"],
    default: "1:1",
  },
] satisfies readonly UpstreamParamProfileField[];

const NODE_INPUTS = [
  { id: "model", name: "model", type: "string", value: "model-a" },
  {
    id: "ai_interface_id",
    name: "ai_interface_id",
    type: "string",
    value: "iface-a",
  },
  { id: "params", name: "params", type: "object", value: { ratio: "1:1" } },
] satisfies WorkflowParameter[];

function renderEditor(
  overrides: Partial<Parameters<typeof useGenerativeParamsEditor>[0]> = {}
) {
  const updateNodeData = vi.fn();
  const onGenerativeDefaultChange = vi.fn();

  const hook = renderHook(
    (props: Parameters<typeof useGenerativeParamsEditor>[0]) =>
      useGenerativeParamsEditor(props),
    {
      initialProps: {
        visible: true,
        disabled: false,
        fields: FIELDS,
        committedValues: { ratio: "1:1" },
        nodeId: "node-1",
        nodeInputs: [...NODE_INPUTS],
        updateNodeData,
        modality: "image" as const,
        generativeDefaults: undefined,
        onGenerativeDefaultChange,
        ...overrides,
      },
    }
  );

  return { ...hook, updateNodeData, onGenerativeDefaultChange };
}

describe("useGenerativeParamsEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces node params on popover close and defaults after node write", () => {
    const { result, updateNodeData, onGenerativeDefaultChange } = renderEditor();

    act(() => {
      result.current.popover.onOpenChange(true);
    });
    act(() => {
      result.current.popover.onFieldChange({ ratio: "16:9" });
    });
    act(() => {
      result.current.popover.onOpenChange(false);
    });

    expect(updateNodeData).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("pending");

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(updateNodeData).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("idle");
    expect(onGenerativeDefaultChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onGenerativeDefaultChange).toHaveBeenCalledTimes(1);
  });

  it("does not commit on close when draft is unchanged", () => {
    const { result, updateNodeData } = renderEditor();

    act(() => {
      result.current.popover.onOpenChange(true);
    });
    act(() => {
      result.current.popover.onOpenChange(false);
    });

    expect(updateNodeData).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("idle");
  });

  it("flushBeforeGenerate writes immediately", () => {
    const { result, updateNodeData } = renderEditor();

    act(() => {
      result.current.popover.onOpenChange(true);
    });
    act(() => {
      result.current.popover.onFieldChange({ ratio: "16:9" });
    });

    let flushed: Record<string, unknown> = {};
    act(() => {
      flushed = result.current.flushBeforeGenerate();
    });

    expect(flushed).toEqual({ ratio: "16:9" });
    expect(updateNodeData).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("idle");
  });

  it("commitNow writes node params without waiting", () => {
    const { result, updateNodeData } = renderEditor({
      onGenerativeDefaultChange: undefined,
    });

    act(() => {
      result.current.commitNow({ ratio: "16:9" });
    });

    expect(updateNodeData).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("idle");
  });

  it("reopening during pending cancels timer and resumes draft", () => {
    const { result, updateNodeData } = renderEditor({
      onGenerativeDefaultChange: undefined,
    });

    act(() => {
      result.current.popover.onOpenChange(true);
    });
    act(() => {
      result.current.popover.onFieldChange({ ratio: "16:9" });
    });
    act(() => {
      result.current.popover.onOpenChange(false);
    });

    act(() => {
      result.current.popover.onOpenChange(true);
    });

    expect(result.current.popover.draft).toEqual({ ratio: "16:9" });
    expect(result.current.phase).toBe("editing");

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(updateNodeData).not.toHaveBeenCalled();
  });

  it("does not overwrite draft from committedValues while editing", () => {
    const { result, rerender } = renderEditor();

    act(() => {
      result.current.popover.onOpenChange(true);
    });
    act(() => {
      result.current.popover.onFieldChange({ ratio: "16:9" });
    });

    rerender({
      visible: true,
      disabled: false,
      fields: FIELDS,
      committedValues: { ratio: "1:1" },
      nodeId: "node-1",
      nodeInputs: [...NODE_INPUTS],
      updateNodeData: vi.fn(),
      modality: "image" as const,
      generativeDefaults: undefined,
      onGenerativeDefaultChange: vi.fn(),
    });

    expect(result.current.popover.draft).toEqual({ ratio: "16:9" });
    expect(result.current.effectiveValues).toEqual({ ratio: "16:9" });
  });

  it("exposes effectiveValues from committedValues when idle", () => {
    const { result } = renderEditor();

    expect(result.current.effectiveValues).toEqual({ ratio: "1:1" });
    expect(result.current.isParamsIdle).toBe(true);
  });
});
