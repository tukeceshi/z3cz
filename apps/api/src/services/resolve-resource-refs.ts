import type { Bindings } from "../context";

import {

  partitionResolvedMediaResourcesByMime,

  resolveMediaResources,

} from "./media-resource-catalog-service";



export interface ResolveResourceRefsRequest {

  readonly resourceIds: readonly string[];

}



export interface ResolvedResourceUrl {

  readonly resourceId: string;

  readonly url: string;

  readonly mimeType: string;

}



export interface ResolveResourceRefsResult {

  readonly resolved: readonly ResolvedResourceUrl[];

  readonly unresolved: readonly string[];

}



export async function resolveResourceRefs(

  env: Bindings,

  params: {

    readonly organizationId: string;

    readonly resourceIds: readonly string[];

  }

): Promise<ResolveResourceRefsResult> {

  const result = await resolveMediaResources(env, params);



  const resolved: ResolvedResourceUrl[] = [];

  for (const entry of result.resolved) {

    if (!entry.url) continue;

    resolved.push({

      resourceId: entry.resourceId,

      url: entry.url,

      mimeType: entry.mimeType,

    });

  }



  return {

    resolved,

    unresolved: result.unresolved,

  };

}



export function partitionResolvedResourceUrls(

  resolved: readonly ResolvedResourceUrl[]

): {

  readonly referenceImageUrls: readonly string[];

  readonly referenceVideoUrls: readonly string[];

  readonly referenceAudioUrls: readonly string[];

} {

  return partitionResolvedMediaResourcesByMime(

    resolved.map((entry) => ({

      resourceId: entry.resourceId,

      kind: "cloud" as const,

      mimeType: entry.mimeType,

      url: entry.url,

    }))

  );

}



export {

  registerMediaResources,

  registerMediaResourcesFromReferences,

  resolveMediaResources,

} from "./media-resource-catalog-service";


