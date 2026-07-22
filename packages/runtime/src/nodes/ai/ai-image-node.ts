import {
  isEphemeralMediaReference,
  isLocalMediaReference,
  type MediaReference,
  type NodeType,
  type ObjectReference,
} from "@dafthunk/types";



import { executeVolcanoImageGeneration } from "../../ai-interface/execute-volcano-image";

import type { NodeContext } from "../../node-types";

import { ExecutableNode, isObjectReference } from "../../node-types";



export const AI_IMAGE_NODE_TYPE = "ai-image" as const;

export const AI_IMAGE_REFERENCE_INPUT = "reference_images" as const;



/**

 * AI Image node — generates images via org Volcano interfaces and platform model catalog.

 */

export class AiImageNode extends ExecutableNode {

  public static readonly nodeType: NodeType = {

    id: "ai-image",

    name: "Image",

    type: "ai-image",

    description:

      "Generate images using an AI model configured via your organization's AI interfaces.",

    documentation: `Generates images using the organization's configured Volcano AI interface.



### Inputs

- **reference_images**: Optional upstream image references (wired on the canvas).

- **prompt**: Image generation prompt (or synced from a connected AI text node).

- **model**: Platform model canonical id (e.g. doubao-seedream-5).

- **params**: Generation parameters configured in admin (size, watermark, etc.).

- **manual_images**: JSON array of ObjectReferences — bypasses generation.



### Outputs

- **images**: Array of generated image references.`,

    tags: ["newai"],

    icon: "image",

    inlinable: false,

    usage: 10,

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

        description: "Image generation prompt.",

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

        name: AI_IMAGE_REFERENCE_INPUT,

        type: "image",

        description: "Upstream image references.",

        required: false,

        hidden: true,

        repeated: true,

      },

      {

        name: "manual_images",

        type: "json",

        description:

          "JSON array of ObjectReferences to return directly, bypassing generation.",

        required: false,

        hidden: true,

      },

    ],

    outputs: [

      {

        name: "images",

        type: "image",

        repeated: true,

        description: "Generated images.",

        hidden: true,

      },

    ],

  };



  public async execute(context: NodeContext): Promise<import("@dafthunk/types").NodeExecution> {

    const manualImages = context.inputs.manual_images;

    if (Array.isArray(manualImages) && manualImages.length > 0) {

      const refs = manualImages.filter(

        (value): value is ObjectReference | MediaReference =>

          isObjectReference(value) ||
          isEphemeralMediaReference(value) ||
          isLocalMediaReference(value)

      );

      if (refs.length > 0) {

        return this.createSuccessResult({ images: refs });

      }

    }



    const prompt =

      typeof context.inputs.prompt === "string" ? context.inputs.prompt : "";

    const referenceValues = context.inputs[AI_IMAGE_REFERENCE_INPUT];

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

    const hasPrompt = prompt.trim().length > 0;

    if (!hasPrompt && referenceRefs.length === 0) {

      return this.createErrorResult("A prompt or reference image is required.");

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



    if (!context.resolveImageModel) {

      return this.createErrorResult(

        "Image model resolution is unavailable in this runtime."

      );

    }



    const resolvedModel = await context.resolveImageModel(modelCanonicalId);

    if (!resolvedModel) {

      return this.createErrorResult(

        `Model "${modelCanonicalId}" is not available for this organization.`

      );

    }



    const interfaceId =

      typeof context.inputs.ai_interface_id === "string" &&

      context.inputs.ai_interface_id.trim().length > 0

        ? context.inputs.ai_interface_id.trim()

        : resolvedModel.interfaceId;



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

          "Local browser-only reference images cannot be used in server workflow runs. Generate from the canvas panel instead."

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



    const storageResolution = context.resolveAiImageStorage

      ? await context.resolveAiImageStorage()

      : { storageMode: "ephemeral" as const };



    const result = await executeVolcanoImageGeneration({

      apiKey: resolvedInterface.apiKey,

      baseUrl: resolvedInterface.baseUrl,

      providerModelId: resolvedModel.providerModelId,

      prompt,

      parameterRules: resolvedModel.parameterRules,

      generationParams,

      referenceImageUrls,

      storageMode: storageResolution.storageMode,

      objectStore: context.objectStore,

      organizationId: context.organizationId,

      workflowId: context.workflowId,

      cloudUpload: storageResolution.cloudUpload,

    });



    if (result.status === "failed") {

      return this.createErrorResult(result.error ?? "Image generation failed");

    }



    return this.createSuccessResult(

      { images: result.images ?? [] },

      result.images?.length ?? 1

    );

  }

}


