import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { WorkflowGenerativeDefaults } from "@dafthunk/types";
import type { UpstreamParamProfileField } from "@dafthunk/types";

import {
  commitGenerativeDefaultParams,
  commitNodeGenerationParams,
} from "./generative-workflow-param-defaults";
import { paramRecordsEqual } from "./param-records-equal";
import type { GenerativeModelModality } from "./org-model-selection-utils";
import type { WorkflowNodeType, WorkflowParameter } from "./workflow-types";

const NODE_PARAMS_COMMIT_DELAY_MS = 400;
const GENERATIVE_DEFAULT_COMMIT_DELAY_MS = 2000;

export type GenerativeParamsEditorPhase = "idle" | "editing" | "pending";

export interface UseGenerativeParamsEditorParams {
  readonly visible: boolean;
  readonly disabled: boolean;
  readonly fields: readonly UpstreamParamProfileField[];
  readonly committedValues: Readonly<Record<string, unknown>>;
  readonly nodeId: string;
  readonly nodeInputs: WorkflowParameter[];
  readonly updateNodeData?: (
    nodeId: string,
    data: Partial<WorkflowNodeType>
  ) => void;
  readonly modality: GenerativeModelModality;
  readonly generativeDefaults?: WorkflowGenerativeDefaults;
  readonly onGenerativeDefaultChange?: (
    defaults: WorkflowGenerativeDefaults
  ) => void;
}

export interface GenerativeParamsPopoverUiProps {
  readonly open: boolean;
  readonly draft: Record<string, unknown>;
  readonly summaryValues: Readonly<Record<string, unknown>>;
  readonly onOpenChange: (open: boolean) => void;
  readonly onFieldChange: (next: Record<string, unknown>) => void;
}

export interface UseGenerativeParamsEditorResult {
  readonly phase: GenerativeParamsEditorPhase;
  readonly isParamsIdle: boolean;
  readonly effectiveValues: Record<string, unknown>;
  readonly popover: GenerativeParamsPopoverUiProps;
  readonly commitNow: (next: Record<string, unknown>) => void;
  readonly flushBeforeGenerate: () => Record<string, unknown>;
}

/** Single source for generative param draft, preview, debounced node commit, and flush. */
export function useGenerativeParamsEditor(
  params: UseGenerativeParamsEditorParams
): UseGenerativeParamsEditorResult {
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [phase, setPhase] = useState<GenerativeParamsEditorPhase>("idle");
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({
    ...params.committedValues,
  }));
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const openedAtRef = useRef<Record<string, unknown>>({
    ...params.committedValues,
  });
  const pendingRef = useRef<Record<string, unknown> | null>(null);
  const nodeTimeoutRef = useRef<number | null>(null);
  const defaultTimeoutRef = useRef<number | null>(null);
  const lastCommittedRef = useRef<Record<string, unknown>>({
    ...params.committedValues,
  });

  useEffect(() => {
    return () => {
      if (nodeTimeoutRef.current !== null) {
        clearTimeout(nodeTimeoutRef.current);
        nodeTimeoutRef.current = null;
      }
      if (defaultTimeoutRef.current !== null) {
        clearTimeout(defaultTimeoutRef.current);
        defaultTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (phase !== "idle") {
      return;
    }
    if (paramRecordsEqual(lastCommittedRef.current, params.committedValues)) {
      return;
    }
    lastCommittedRef.current = { ...params.committedValues };
    const snapshot = { ...params.committedValues };
    draftRef.current = snapshot;
    setDraft(snapshot);
    openedAtRef.current = snapshot;
  }, [params.committedValues, phase]);

  const scheduleGenerativeDefaultCommit = useCallback(
    (next: Record<string, unknown>) => {
      if (defaultTimeoutRef.current !== null) {
        clearTimeout(defaultTimeoutRef.current);
      }
      defaultTimeoutRef.current = window.setTimeout(() => {
        defaultTimeoutRef.current = null;
        const current = paramsRef.current;
        if (!current.onGenerativeDefaultChange || !current.updateNodeData) {
          return;
        }
        commitGenerativeDefaultParams({
          next,
          fields: current.fields,
          nodeId: current.nodeId,
          nodeInputs: current.nodeInputs,
          updateNodeData: current.updateNodeData,
          modality: current.modality,
          generativeDefaults: current.generativeDefaults,
          onGenerativeDefaultChange: current.onGenerativeDefaultChange,
        });
      }, GENERATIVE_DEFAULT_COMMIT_DELAY_MS);
    },
    []
  );

  const commitToNode = useCallback(
    (next: Record<string, unknown>) => {
      const current = paramsRef.current;
      if (!current.visible || current.disabled || !current.updateNodeData) {
        return;
      }
      commitNodeGenerationParams({
        next,
        fields: current.fields,
        nodeId: current.nodeId,
        nodeInputs: current.nodeInputs,
        updateNodeData: current.updateNodeData,
      });
      if (current.onGenerativeDefaultChange) {
        scheduleGenerativeDefaultCommit(next);
      }
      lastCommittedRef.current = { ...next };
    },
    [scheduleGenerativeDefaultCommit]
  );

  const cancelPendingCommit = useCallback((): Record<string, unknown> | null => {
    if (nodeTimeoutRef.current !== null) {
      clearTimeout(nodeTimeoutRef.current);
      nodeTimeoutRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) {
      return pending;
    }
    return null;
  }, []);

  const schedulePendingCommit = useCallback(
    (next: Record<string, unknown>) => {
      pendingRef.current = next;
      setPhase("pending");
      if (nodeTimeoutRef.current !== null) {
        clearTimeout(nodeTimeoutRef.current);
      }
      nodeTimeoutRef.current = window.setTimeout(() => {
        nodeTimeoutRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (!pending) {
          setPhase("idle");
          return;
        }
        commitToNode(pending);
        const snapshot = { ...pending };
        draftRef.current = snapshot;
        setDraft(snapshot);
        openedAtRef.current = snapshot;
        setPhase("idle");
      }, NODE_PARAMS_COMMIT_DELAY_MS);
    },
    [commitToNode]
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        const resumed = cancelPendingCommit();
        const snapshot = resumed ?? { ...paramsRef.current.committedValues };
        openedAtRef.current = snapshot;
        draftRef.current = snapshot;
        setDraft(snapshot);
        setPhase("editing");
        return;
      }

      const next = draftRef.current;
      if (!paramRecordsEqual(openedAtRef.current, next)) {
        schedulePendingCommit(next);
        return;
      }
      pendingRef.current = null;
      setPhase("idle");
    },
    [cancelPendingCommit, schedulePendingCommit]
  );

  const onFieldChange = useCallback((next: Record<string, unknown>) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const commitNow = useCallback(
    (next: Record<string, unknown>) => {
      cancelPendingCommit();
      commitToNode(next);
      const snapshot = { ...next };
      pendingRef.current = null;
      openedAtRef.current = snapshot;
      draftRef.current = snapshot;
      setDraft(snapshot);
      setPhase("idle");
    },
    [cancelPendingCommit, commitToNode]
  );

  const flushBeforeGenerate = useCallback((): Record<string, unknown> => {
    cancelPendingCommit();
    const current = paramsRef.current;
    const next =
      phase === "idle"
        ? { ...current.committedValues }
        : { ...draftRef.current };
    commitToNode(next);
    pendingRef.current = null;
    openedAtRef.current = next;
    draftRef.current = next;
    setDraft(next);
    setPhase("idle");
    return next;
  }, [cancelPendingCommit, commitToNode, phase]);

  const effectiveValues = useMemo(() => {
    if (phase === "idle") {
      return { ...params.committedValues };
    }
    return { ...draft };
  }, [draft, params.committedValues, phase]);

  const summaryValues = useMemo(() => {
    if (phase === "idle") {
      return params.committedValues;
    }
    return draft;
  }, [draft, params.committedValues, phase]);

  const popover = useMemo(
    (): GenerativeParamsPopoverUiProps => ({
      open: phase === "editing",
      draft,
      summaryValues,
      onOpenChange: handleOpenChange,
      onFieldChange,
    }),
    [draft, handleOpenChange, onFieldChange, phase, summaryValues]
  );

  return {
    phase,
    isParamsIdle: phase === "idle",
    effectiveValues,
    popover,
    commitNow,
    flushBeforeGenerate,
  };
}
