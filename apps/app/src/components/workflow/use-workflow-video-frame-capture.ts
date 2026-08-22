import { useCallback, useRef } from "react";

import type { VideoFrameCaptureMode } from "./capture-video-frame";
import { useVideoFrameToAiImageNode } from "./use-video-frame-to-ai-image-node";
import { useWorkflow } from "./workflow-context";

export function useWorkflowVideoFrameCapture(nodeId: string | undefined) {
  const { disabled } = useWorkflow();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { captureFrameToAiImageNode, isCapturing } =
    useVideoFrameToAiImageNode(nodeId ?? "");

  const onFrameCapture = useCallback(
    (mode: VideoFrameCaptureMode) => {
      const video = videoRef.current;
      if (!video) return;
      void captureFrameToAiImageNode(video, mode);
    },
    [captureFrameToAiImageNode]
  );

  return {
    videoRef,
    showFrameCapture: Boolean(nodeId),
    frameCaptureDisabled: disabled || isCapturing,
    onFrameCapture,
  };
}
