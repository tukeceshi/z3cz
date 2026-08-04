import {
  isEphemeralMediaReference,
  isLocalMediaReference,
  type MediaReference,
  type NodeExecution,
  type NodeType,
  type ObjectReference,
} from "@dafthunk/types";

import { executeMinimaxAudioGeneration } from "../../ai-interface/execute-minimax-audio-generation";
import type { NodeContext } from "../../node-types";
import { ExecutableNode, isObjectReference } from "../../node-types";
import {
  readModelInterfaceIdInput,
  resolveModelInterfaceIdFromInputs,
} from "./resolve-model-interface-id";

export const AI_AUDIO_NODE_TYPE = "ai-audio" as const;

/**
 * AI Audio node — generates speech via org MiniMax interfaces and platform model catalog.
 */
export class AiAudioNode extends ExecutableNode {
  public static readonly nodeType: NodeType = {
    id: "ai-audio",
    name: "Audio",
    type: "ai-audio",
    description:
      "Generate audio using an AI model configured via your organization's AI interfaces.",
    documentation: `Generates speech audio using the organization's configured MiniMax AI interface.

### Inputs
- **prompt**: Text-to-speech prompt (or synced from a connected AI text node).
- **model**: Platform model canonical id.
- **params**: Generation parameters configured in admin (voice, speed, etc.).
- **manual_audios**: JSON array of media references — bypasses generation.

### Outputs
- **audios**: Array of generated audio references.`,
    tags: ["newai"],
    icon: "music",
    inlinable: false,
    usage: 5,
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
        description: "Text-to-speech prompt.",
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
        name: "manual_audios",
        type: "json",
        description:
          "JSON array of media references to return directly, bypassing generation.",
        required: false,
        hidden: true,
      },
    ],
    outputs: [
      {
        name: "audios",
        type: "audio",
        repeated: true,
        description: "Generated audio files.",
        hidden: true,
      },
    ],
  };

  public async execute(context: NodeContext): Promise<NodeExecution> {
    const manualAudios = context.inputs.manual_audios;
    if (Array.isArray(manualAudios) && manualAudios.length > 0) {
      const refs = manualAudios.filter(
        (value): value is ObjectReference | MediaReference =>
          isObjectReference(value) ||
          isEphemeralMediaReference(value) ||
          isLocalMediaReference(value)
      );
      if (refs.length > 0) {
        return this.createSuccessResult({ audios: refs }, refs.length);
      }
    }

    const prompt =
      typeof context.inputs.prompt === "string" ? context.inputs.prompt : "";
    if (prompt.trim().length === 0) {
      return this.createErrorResult("A prompt is required.");
    }

    if (!context.resolveAiInterface) {
      return this.createErrorResult(
        "No AI interface configured. Please set up an AI interface in your organization settings."
      );
    }

    const modelCanonicalId =
      typeof context.inputs.model === "string" &&
      context.inputs.model.trim().length > 0
        ? context.inputs.model.trim()
        : undefined;

    if (!modelCanonicalId) {
      return this.createErrorResult("A model selection is required.");
    }

    const interfaceId = await resolveModelInterfaceIdFromInputs(
      readModelInterfaceIdInput(context),
      modelCanonicalId,
      context.inferAudioModelInterfaceId
    );

    if (!interfaceId) {
      return this.createErrorResult("An AI interface must be selected.");
    }

    if (!context.resolveAudioModel) {
      return this.createErrorResult(
        "Audio model resolution is unavailable in this runtime."
      );
    }

    const resolvedModel = await context.resolveAudioModel(
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

    let storageResolution: Awaited<
      ReturnType<NonNullable<typeof context.resolveAiAudioStorage>>
    >;
    try {
      storageResolution = context.resolveAiAudioStorage
        ? await context.resolveAiAudioStorage()
        : { storageMode: "ephemeral" as const };
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error
          ? error.message
          : "Cloud storage is unavailable for audio persistence"
      );
    }

    const result = await executeMinimaxAudioGeneration({
      apiKey: resolvedInterface.apiKey,
      baseUrl: resolvedInterface.baseUrl,
      providerModelId: resolvedModel.providerModelId,
      prompt,
      parameterRules: resolvedModel.parameterRules,
      generationParams,
      storageMode: storageResolution.storageMode,
      objectStore: context.objectStore,
      organizationId: context.organizationId,
      workflowId: context.workflowId,
      cloudUpload: storageResolution.cloudUpload,
    });

    if (result.status === "failed") {
      return this.createErrorResult(result.error ?? "Audio generation failed");
    }

    return this.createSuccessResult(
      { audios: result.audios ?? [] },
      result.audios?.length ?? 1
    );
  }
}
