import {

  buildVolcanoImageGenerationBody,

  type EphemeralMediaReference,

  type ImageModelParameterRules,

  type MediaReference,

  type ObjectReference,

  type ReferenceImageInline,

  normalizeImageModelParameterRules,

} from "@dafthunk/types";



import type { ObjectStore } from "../node-types";



export type VolcanoImageStorageMode = "ephemeral" | "cloud";



export interface VolcanoImageGenerationResult {

  readonly status: "completed" | "failed";

  readonly images?: readonly MediaReference[];

  readonly error?: string;

  readonly storageMode?: VolcanoImageStorageMode;

}



export interface CloudImageUploadTarget {

  readonly upload: (params: {

    readonly workflowId: string;

    readonly data: Uint8Array;

    readonly mimeType: string;

    readonly objectId: string;

  }) => Promise<ObjectReference>;

}



interface VolcanoImageResponse {

  readonly data?: readonly { readonly url?: string }[];

  readonly error?: { readonly message?: string };

}



function inferMimeTypeFromUrl(url: string): string {

  const lower = url.split("?")[0]?.toLowerCase() ?? "";

  if (lower.endsWith(".png")) return "image/png";

  if (lower.endsWith(".webp")) return "image/webp";

  if (lower.endsWith(".gif")) return "image/gif";

  return "image/jpeg";

}



const EPHEMERAL_TTL_MS = 3_600_000;



export async function executeVolcanoImageGeneration(params: {

  readonly apiKey: string;

  readonly baseUrl: string;

  readonly providerModelId: string;

  readonly prompt: string;

  readonly parameterRules: ImageModelParameterRules;

  readonly generationParams?: Readonly<Record<string, unknown>>;

  readonly referenceImageUrls?: readonly string[];

  readonly referenceImageInline?: readonly ReferenceImageInline[];

  readonly storageMode: VolcanoImageStorageMode;

  readonly objectStore?: ObjectStore;

  readonly organizationId: string;

  readonly workflowId?: string;

  readonly cloudUpload?: CloudImageUploadTarget;

  readonly timeoutMs?: number;

}): Promise<VolcanoImageGenerationResult> {

  const rules = normalizeImageModelParameterRules(params.parameterRules);

  const trimmedPrompt = params.prompt.trim();
  const hasReferences =
    (params.referenceImageUrls?.length ?? 0) > 0 ||
    (params.referenceImageInline?.length ?? 0) > 0;

  if (!trimmedPrompt && !hasReferences) {
    return { status: "failed", error: "Prompt is required" };
  }

  if (
    trimmedPrompt.length > 0 &&
    trimmedPrompt.length > rules.promptMaxChars
  ) {

    return {

      status: "failed",

      error: `Prompt exceeds maximum length of ${rules.promptMaxChars} characters`,

    };

  }



  const body = buildVolcanoImageGenerationBody({

    providerModelId: params.providerModelId,

    prompt: trimmedPrompt,

    generationFields: rules.generationFields,

    params: params.generationParams,

    referenceImageUrls: params.referenceImageUrls,

    referenceImageInline: params.referenceImageInline,

  });



  const baseUrl = params.baseUrl.replace(/\/$/, "");

  const url = `${baseUrl}/images/generations`;

  const controller = new AbortController();

  const timeout = setTimeout(

    () => controller.abort(),

    params.timeoutMs ?? 120_000

  );



  try {

    const response = await fetch(url, {

      method: "POST",

      headers: {

        Authorization: `Bearer ${params.apiKey}`,

        "Content-Type": "application/json",

      },

      body: JSON.stringify(body),

      signal: controller.signal,

    });



    const text = await response.text();

    let parsed: VolcanoImageResponse = {};

    try {

      parsed = JSON.parse(text) as VolcanoImageResponse;

    } catch {

      return {

        status: "failed",

        error: `Upstream returned non-JSON response (${response.status})`,

      };

    }



    if (!response.ok) {

      return {

        status: "failed",

        error:

          parsed.error?.message ??

          `Upstream request failed (${response.status}): ${text.slice(0, 300)}`,

      };

    }



    const imageUrls =

      parsed.data

        ?.map((entry) => entry.url)

        .filter((entry): entry is string => typeof entry === "string") ?? [];



    if (imageUrls.length === 0) {

      return { status: "failed", error: "No image URLs in upstream response" };

    }



    if (params.storageMode === "ephemeral") {

      const expiresAt = new Date(Date.now() + EPHEMERAL_TTL_MS).toISOString();

      const images: EphemeralMediaReference[] = imageUrls.map((imageUrl) => ({

        kind: "ephemeral",

        url: imageUrl,

        mimeType: inferMimeTypeFromUrl(imageUrl),

        mediaId: crypto.randomUUID(),

        expiresAt,

      }));

      return { status: "completed", images, storageMode: "ephemeral" };

    }



    if (!params.objectStore && !params.cloudUpload) {

      return {

        status: "failed",

        error: "Cloud storage is not available for persistence",

      };

    }



    const workflowId = params.workflowId?.trim() || "unknown";

    const images: ObjectReference[] = [];



    for (const imageUrl of imageUrls) {

      const imageResponse = await fetch(imageUrl);

      if (!imageResponse.ok) {

        return {

          status: "failed",

          error: `Failed to download generated image (${imageResponse.status})`,

        };

      }



      const mimeType =

        imageResponse.headers.get("content-type")?.split(";")[0]?.trim() ||

        inferMimeTypeFromUrl(imageUrl);

      const buffer = new Uint8Array(await imageResponse.arrayBuffer());



      if (params.cloudUpload) {

        const objectId = crypto.randomUUID();

        images.push(

          await params.cloudUpload.upload({

            workflowId,

            data: buffer,

            mimeType,

            objectId,

          })

        );

        continue;

      }



      if (!params.objectStore) {

        return {

          status: "failed",

          error: "Object store is not available",

        };

      }



      const reference = await params.objectStore.writeObject(

        buffer,

        mimeType,

        params.organizationId

      );

      images.push(reference);

    }



    return { status: "completed", images, storageMode: "cloud" };

  } catch (error) {

    return {

      status: "failed",

      error: error instanceof Error ? error.message : "Image generation failed",

    };

  } finally {

    clearTimeout(timeout);

  }

}


