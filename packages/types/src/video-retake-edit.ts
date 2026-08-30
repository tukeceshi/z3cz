import { isAdaptiveVideoRatio } from "./platform-ai-model";

export const VIDEO_RETAKE_EDIT_OMNI_REFERENCE_TASK_TYPE = "edit" as const;
export const VIDEO_RETAKE_EDIT_RATIO = "adaptive" as const;
export const VIDEO_RETAKE_EDIT_DURATION = -1 as const;

export const VIDEO_RETAKE_EDIT_OVERRIDES = {
  omni_reference_task_type: VIDEO_RETAKE_EDIT_OMNI_REFERENCE_TASK_TYPE,
  ratio: VIDEO_RETAKE_EDIT_RATIO,
  duration: VIDEO_RETAKE_EDIT_DURATION,
} as const;

/** Overlay retake edit fields after ordinary param sanitization. */
export function applyVideoRetakeEditOverrides(
  params: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  return {
    ...params,
    ...VIDEO_RETAKE_EDIT_OVERRIDES,
  };
}

export function isVideoRetakeEditRequest(
  params?: Readonly<Record<string, unknown>>
): boolean {
  if (!params) {
    return false;
  }
  return (
    params.omni_reference_task_type ===
      VIDEO_RETAKE_EDIT_OMNI_REFERENCE_TASK_TYPE &&
    isAdaptiveVideoRatio(params.ratio) &&
    params.duration === VIDEO_RETAKE_EDIT_DURATION
  );
}

/**
 * Force retake edit fields onto the outbound Volcano body.
 * Call after merge / omit-adaptive / forwarding so `-1` and `adaptive` survive.
 */
export function applyVideoRetakeEditOverridesToRequestBody(
  body: Readonly<Record<string, unknown>>,
  generationParams?: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  if (!isVideoRetakeEditRequest(generationParams)) {
    return { ...body };
  }
  return {
    ...body,
    ...VIDEO_RETAKE_EDIT_OVERRIDES,
  };
}
