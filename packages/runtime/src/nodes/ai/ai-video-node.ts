import {
  isEphemeralMediaReference,
  isLocalMediaReference,
  isGrokImagineVideoCanonicalId,
  isVeoCanonicalId,
  type MediaReference,
  type NodeExecution,
  type NodeType,
  type ObjectReference,
} from "@dafthunk/types";

import { submitVolcanoVideoTask } from "../../ai-interface/execute-volcano-video";
import {
  createGrokVideoPollContinuation,
  submitGrokVideoTask,
} from "../../ai-interface/execute-grok-video";
import {
  createVeoVideoPollContinuation,
  submitVeoVideoTask,
} from "../../ai-interface/execute-veo-video";
import type { NodeContext } from "../../node-types";
import { ExecutableNode, isObjectReference } from "../../node-types";
import {
  awaitVolcanoVideoOrPending,
  createVolcanoVideoPollContinuation,
} from "./await-volcano-video-or-pending";

export const AI_VIDEO_NODE_TYPE = "ai-video" as const;
export const AI_VIDEO_REFERENCE_INPUT = "reference_images" as const;

/**
 * AI Video node — generates videos via org Volcano interfaces and platform model catalog.
 */
export class AiVideoNode extends ExecutableNode {
  public static readonly nodeType: NodeType = {
    id: "ai-video",
    name: "Video",
    type: "ai-video",
    description:
      "Generate videos using an AI model configured via your organization's AI interfaces.",
    documentation: `Generates videos using the organization's configured Volcano AI interface.

### Inputs
- **reference_images**: Optional upstream image references for image-to-video.
- **prompt**: Video generation prompt (or synced from a connected AI text node).
- **model**: Platform model canonical id (e.g. doubao-seedance-2).
- **params**: Generation parameters configured in admin (ratio, duration, etc.).
- **manual_videos**: JSON array of media references — bypasses generation.

### Outputs
- **videos**: Array of generated video references.`,
    tags: ["newai"],
    icon: "video",
    inlinable: false,
    usage: 50,
    inputs: [
      {
        name: "ai_interface_id",
        type: "string",
        description: "Resolved automatically from the selected model.",
        required: false,
        hidden: true,
      },
      {
        name: "model",
        type: "string",
        description: "Platform model canonical id.",
        required: false,
        hidden: true,
      },
      {
        name: "prompt",
        type: "string",
        description: "Video generation prompt.",
        required: false,
        hidden: true,
      },
      {
        name: "params",
        type: "json",
        description: "Generation parameters from admin model rules.",
        required: false,
        hidden: true,
      },
      {
        name: AI_VIDEO_REFERENCE_INPUT,
        type: "image",
        description: "Upstream image references for image-to-video.",
        required: false,
        hidden: true,
        repeated: true,
      },
      {
        name: "manual_videos",
        type: "json",
        description:
          "JSON array of media references to return directly, bypassing generation.",
        required: false,
        hidden: true,
      },
    ],
    outputs: [
      {
        name: "videos",
        type: "video",
        repeated: true,
        description: "Generated videos.",
        hidden: true,
      },
    ],
  };

  public async execute(context: NodeContext): Promise<NodeExecution> {
    const manualVideos = context.inputs.manual_videos;
    if (Array.isArray(manualVideos) && manualVideos.length > 0) {
      const refs = manualVideos.filter(
        (value): value is ObjectReference | MediaReference =>
          isObjectReference(value) ||
          isEphemeralMediaReference(value) ||
          isLocalMediaReference(value)
      );
      if (refs.length > 0) {
        return this.createSuccessResult({ videos: refs }, refs.length);
      }
    }

    const prompt = context.inputs.prompt;
    const referenceValues = context.inputs[AI_VIDEO_REFERENCE_INPUT];
    const referenceRefs: MediaReference[] = Array.isArray(referenceValues)
      ? referenceValues.filter(
          (value): value is MediaReference =>
            isObjectReference(value) ||
            isEphemeralMediaReference(value) ||
            isLocalMediaReference(value)
        )
      : isObjectReference(referenceValues) ||
          isEphemeralMediaReference(referenceValues) ||
          isLocalMediaReference(referenceValues)
        ? [referenceValues]
        : [];

    const hasPrompt = typeof prompt === "string" && prompt.trim().length > 0;
    if (!hasPrompt && referenceRefs.length === 0) {
      return this.createErrorResult("A prompt or reference image is required.");
    }

    const modelCanonicalId = context.inputs.model;
    if (
      typeof modelCanonicalId !== "string" ||
      modelCanonicalId.trim().length === 0
    ) {
      return this.createErrorResult("A model selection is required.");
    }

    const interfaceId =
      typeof context.inputs.ai_interface_id === "string" &&
      context.inputs.ai_interface_id.trim().length > 0
        ? context.inputs.ai_interface_id.trim()
        : undefined;

    if (!interfaceId) {
      return this.createErrorResult("An AI interface must be selected.");
    }

    if (!context.resolveVideoModel) {
      return this.createErrorResult(
        "Video model resolution is unavailable in this runtime."
      );
    }

    const resolvedModel = await context.resolveVideoModel(
      modelCanonicalId,
      interfaceId
    );
    if (!resolvedModel) {
      return this.createErrorResult(
        `Model "${modelCanonicalId}" is not available for this organization.`
      );
    }

    const resolvedInterface = await context.resolveAiInterface({ interfaceId });
    if (!resolvedInterface) {
      return this.createErrorResult(
        "Could not resolve an AI interface. Please configure an AI interface in your organization settings."
      );
    }

    const generationParams =
      context.inputs.params && typeof context.inputs.params === "object"
        ? (context.inputs.params as Record<string, unknown>)
        : undefined;

    const referenceImageUrls: string[] = [];
    for (const ref of referenceRefs) {
      if (isLocalMediaReference(ref)) {
        return this.createErrorResult(
          "Local browser-only reference images cannot be used in server workflow runs."
        );
      }

      if (isEphemeralMediaReference(ref)) {
        referenceImageUrls.push(ref.url);
        continue;
      }

      if (!context.objectStore) {
        return this.createErrorResult(
          "Object store is not available for reference images."
        );
      }

      referenceImageUrls.push(
        await context.objectStore.getPresignedUrl(ref, 3600)
      );
    }

    const storageResolution = context.resolveAiVideoStorage
      ? await context.resolveAiVideoStorage().catch((error: unknown) => {
          return {
            error:
              error instanceof Error
                ? error.message
                : "Cloud storage is unavailable for video generation",
          } as const;
        })
      : { storageMode: "ephemeral" as const };

    if ("error" in storageResolution) {
      return this.createErrorResult(storageResolution.error);
    }

    const trimmedModelId = modelCanonicalId.trim();
    const isGrokVideo = isGrokImagineVideoCanonicalId(trimmedModelId);
    const isVeo = isVeoCanonicalId(trimmedModelId);
    if ((isGrokVideo || isVeo) && referenceImageUrls.length > 0) {
      return this.createErrorResult(
        isGrokVideo
          ? "Reference images are not supported for Grok Imagine Video in this version."
          : "Reference images are not supported for Veo in this version."
      );
    }

    const submitResult = isGrokVideo
      ? await submitGrokVideoTask({
          apiKey: resolvedInterface.apiKey,
          baseUrl: resolvedInterface.baseUrl,
          providerModelId: resolvedModel.providerModelId,
          prompt: typeof prompt === "string" ? prompt : "",
          parameterRules: resolvedModel.parameterRules,
          generationParams,
        })
      : isVeo
        ? await submitVeoVideoTask({
            apiKey: resolvedInterface.apiKey,
            baseUrl: resolvedInterface.baseUrl,
            providerModelId: resolvedModel.providerModelId,
            prompt: typeof prompt === "string" ? prompt : "",
            parameterRules: resolvedModel.parameterRules,
            generationParams,
          })
        : await submitVolcanoVideoTask({
            apiKey: resolvedInterface.apiKey,
            baseUrl: resolvedInterface.baseUrl,
            providerModelId: resolvedModel.providerModelId,
            prompt: typeof prompt === "string" ? prompt : "",
            parameterRules: resolvedModel.parameterRules,
            generationParams,
            referenceImageUrls,
          });

    if (submitResult.status === "failed" || !submitResult.taskId) {
      return this.createErrorResult(
        submitResult.error ?? "Video generation failed to start"
      );
    }

    let generationJobId: string | null = null;
    if (
      storageResolution.storageMode === "cloud" &&
      context.trackWorkflowGenerationJob
    ) {
      generationJobId = await context.trackWorkflowGenerationJob.begin({
        organizationId: context.organizationId,
        workflowId: context.workflowId,
        executionId: context.executionId,
        nodeId: context.nodeId,
        modality: "video",
        modelCanonicalId: modelCanonicalId.trim(),
        interfaceId,
        upstreamTaskId: submitResult.taskId,
        videoPollUrl: submitResult.pollUrl,
      });
    }

    const continuation = isGrokVideo
      ? createGrokVideoPollContinuation({
          nodeId: this.node.id,
          taskId: submitResult.taskId,
          pollUrl: submitResult.pollUrl ?? submitResult.taskId,
          interfaceId,
          organizationId: context.organizationId,
          pollIntervalMs: 10_000,
          timeoutMinutes: 60,
          generationJobId: generationJobId ?? undefined,
        })
      : isVeo
        ? createVeoVideoPollContinuation({
            nodeId: this.node.id,
            taskId: submitResult.taskId,
            pollUrl: submitResult.pollUrl ?? submitResult.taskId,
            interfaceId,
            organizationId: context.organizationId,
            pollIntervalMs: 10_000,
            timeoutMinutes: 60,
            generationJobId: generationJobId ?? undefined,
          })
        : createVolcanoVideoPollContinuation({
            nodeId: this.node.id,
            taskId: submitResult.taskId,
            pollUrl: submitResult.pollUrl ?? submitResult.taskId,
            interfaceId,
            organizationId: context.organizationId,
            pollIntervalMs: 10_000,
            timeoutMinutes: 60,
            generationJobId: generationJobId ?? undefined,
          });

    return awaitVolcanoVideoOrPending({
      context,
      continuation,
      apiKey: resolvedInterface.apiKey,
      timeoutLabel: "60 minutes",
      storageMode: storageResolution.storageMode,
      cloudUpload: storageResolution.cloudUpload,
      generationJobId: generationJobId ?? undefined,
      nodeOutputs: AiVideoNode.nodeType.outputs ?? [],
      createSuccessResult: (outputs, usage) =>
        this.createSuccessResult(outputs, usage),
      createErrorResult: (error, usage) =>
        this.createErrorResult(error, usage),
    });
  }
}
