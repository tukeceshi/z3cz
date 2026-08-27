import { useCallback, useEffect, useRef, useState } from "react";

import {
  GenerativeGenerationCancelRejectedError,
  type GenerativeGenerationCancelResult,
  markNodeGenerationCancelled,
  registerGenerativeGenerationCancel,
  resetNodeGenerationCancelled,
  unregisterGenerativeGenerationCancel,
} from "@/components/workflow/generative-generation-cancel";
import { readGenerativeProgressJobId } from "@/components/workflow/generative-progress-utils";
import { cancelGenerationJob } from "@/services/platform-ai-model-service";
import type { PersistGenerativeMediaPhase } from "@/services/persist-generative-media-from-url";
import { isGenerationJobPastUpstreamGeneration } from "@dafthunk/types";
import type { CancelGenerationJobResponse } from "@dafthunk/types";

interface UseGenerativeGenerationSessionOptions {
  readonly nodeId: string;
  readonly orgId: string | undefined;
  readonly metadata: Record<string, string> | undefined;
  readonly onCancelConfirmed?: (response: CancelGenerationJobResponse) => void;
  readonly onCancelDeferred?: (response: CancelGenerationJobResponse) => void;
  readonly onCancelNotApplied?: (response: CancelGenerationJobResponse) => void;
  readonly setIsGenerating: (generating: boolean) => void;
  readonly setPersistPhase: (phase: PersistGenerativeMediaPhase | null) => void;
  readonly generateInFlightRef: React.MutableRefObject<boolean>;
}

export function useGenerativeGenerationSession(
  options: UseGenerativeGenerationSessionOptions
): {
  readonly beginSession: () => AbortSignal;
  readonly trackJobId: (jobId: string | null) => void;
  readonly trackClientRequestId: (clientRequestId: string | null) => void;
  readonly isCancelConfirmed: () => boolean;
  readonly isCancelled: () => boolean;
  readonly isCancelling: boolean;
  readonly shouldAbortJobPoll: () => boolean;
  readonly cancel: () => Promise<GenerativeGenerationCancelResult>;
  readonly flushDeferredCancelIfPending: () => Promise<GenerativeGenerationCancelResult | null>;
} {
  const abortRef = useRef<AbortController | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const clientRequestIdRef = useRef<string | null>(null);
  const cancelConfirmedRef = useRef(false);
  const cancelPendingRef = useRef(false);
  const cancelDeferredRef = useRef(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [cancelDeferred, setCancelDeferred] = useState(false);
  const [cancelApiInFlight, setCancelApiInFlight] = useState(false);

  const beginSession = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    resetNodeGenerationCancelled(options.nodeId);
    cancelConfirmedRef.current = false;
    cancelPendingRef.current = false;
    cancelDeferredRef.current = false;
    setCancelDeferred(false);
    setCancelPending(false);
    jobIdRef.current = null;
    clientRequestIdRef.current = null;
    return controller.signal;
  }, [options.nodeId]);

  const trackJobId = useCallback((jobId: string | null) => {
    jobIdRef.current = jobId;
  }, []);

  const trackClientRequestId = useCallback((clientRequestId: string | null) => {
    clientRequestIdRef.current = clientRequestId;
  }, []);

  const finalizeLocalCancel = useCallback(() => {
    options.setPersistPhase(null);
    options.setIsGenerating(false);
    options.generateInFlightRef.current = false;
    cancelDeferredRef.current = false;
    setCancelDeferred(false);
  }, [options]);

  const executeCancel = useCallback(
    async (jobId: string): Promise<GenerativeGenerationCancelResult> => {
      if (!options.orgId) {
        throw new GenerativeGenerationCancelRejectedError(
          "No active generation job to cancel"
        );
      }

      setCancelApiInFlight(true);
      try {
        const response = await cancelGenerationJob(options.orgId, jobId);

        if (response.cancelled) {
          cancelPendingRef.current = false;
          setCancelPending(false);
          cancelDeferredRef.current = false;
          setCancelDeferred(false);
          cancelConfirmedRef.current = true;
          markNodeGenerationCancelled(options.nodeId);
          abortRef.current?.abort();
          finalizeLocalCancel();
          options.onCancelConfirmed?.(response);
          return { kind: "cancelled", response };
        }

        if (response.cancelPending) {
          cancelPendingRef.current = false;
          setCancelPending(false);
          cancelDeferredRef.current = true;
          setCancelDeferred(true);
          options.onCancelDeferred?.(response);
          return { kind: "cancelling", response };
        }

        if (isGenerationJobPastUpstreamGeneration(response.job)) {
          cancelPendingRef.current = false;
          setCancelPending(false);
          cancelDeferredRef.current = false;
          setCancelDeferred(false);
          return { kind: "completed", response };
        }

        cancelPendingRef.current = false;
        setCancelPending(false);
        cancelDeferredRef.current = false;
        setCancelDeferred(false);
        options.onCancelNotApplied?.(response);
        return { kind: "not_applied", response };
      } finally {
        setCancelApiInFlight(false);
      }
    },
    [finalizeLocalCancel, options]
  );

  const flushDeferredCancelIfPending = useCallback(async (): Promise<
    GenerativeGenerationCancelResult | null
  > => {
    if (!cancelPendingRef.current) {
      return null;
    }

    const jobId =
      jobIdRef.current ?? readGenerativeProgressJobId(options.metadata);
    if (!jobId) {
      return null;
    }

    return executeCancel(jobId);
  }, [executeCancel, options.metadata]);

  const cancel = useCallback(async (): Promise<GenerativeGenerationCancelResult> => {
    const jobId =
      jobIdRef.current ?? readGenerativeProgressJobId(options.metadata);
    const clientRequestId = clientRequestIdRef.current;

    if (!options.orgId || (!jobId && !clientRequestId)) {
      throw new GenerativeGenerationCancelRejectedError(
        "No active generation job to cancel"
      );
    }

    if (!jobId) {
      cancelPendingRef.current = true;
      setCancelPending(true);
      return { kind: "pending" };
    }

    return executeCancel(jobId);
  }, [executeCancel, options.metadata, options.orgId]);

  useEffect(() => {
    registerGenerativeGenerationCancel(options.nodeId, cancel);
    return () => {
      unregisterGenerativeGenerationCancel(options.nodeId);
    };
  }, [cancel, options.nodeId]);

  const isCancelConfirmed = useCallback(() => cancelConfirmedRef.current, []);

  const readCancelled = useCallback(() => {
    return (
      cancelConfirmedRef.current ||
      (abortRef.current?.signal.aborted ?? false)
    );
  }, []);

  return {
    beginSession,
    trackJobId,
    trackClientRequestId,
    isCancelConfirmed,
    isCancelled: readCancelled,
    isCancelling: cancelPending || cancelApiInFlight || cancelDeferred,
    shouldAbortJobPoll: isCancelConfirmed,
    cancel,
    flushDeferredCancelIfPending,
  };
}
