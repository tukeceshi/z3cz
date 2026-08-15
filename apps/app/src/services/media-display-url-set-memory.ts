export interface RememberedMediaDisplayUrlSet {
  readonly full: string | null;
  readonly s: string | null;
  readonly m: string | null;
  readonly l: string | null;
}

const rememberedUrlSets = new Map<string, RememberedMediaDisplayUrlSet>();

function memoryKey(
  organizationId: string,
  workflowId: string,
  mediaId: string
): string {
  return `${organizationId}:${workflowId}:${mediaId}`;
}

export function mediaDisplayUrlSetsEqual(
  left: RememberedMediaDisplayUrlSet,
  right: RememberedMediaDisplayUrlSet
): boolean {
  return (
    left.full === right.full &&
    left.s === right.s &&
    left.m === right.m &&
    left.l === right.l
  );
}

export function hasRememberedDisplayThumb(
  set: RememberedMediaDisplayUrlSet
): boolean {
  return Boolean(set.s || set.full);
}

export function rememberMediaDisplayUrlSet(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
  readonly urlSet: RememberedMediaDisplayUrlSet;
}): void {
  if (!hasRememberedDisplayThumb(params.urlSet)) {
    return;
  }
  rememberedUrlSets.set(
    memoryKey(params.organizationId, params.workflowId, params.mediaId),
    params.urlSet
  );
}

export function recallMediaDisplayUrlSet(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
}): RememberedMediaDisplayUrlSet | null {
  return (
    rememberedUrlSets.get(
      memoryKey(params.organizationId, params.workflowId, params.mediaId)
    ) ?? null
  );
}

export function forgetMediaDisplayUrlSetsForMediaId(mediaId: string): void {
  for (const key of [...rememberedUrlSets.keys()]) {
    if (key.endsWith(`:${mediaId}`) || key.includes(`:${mediaId}:`)) {
      rememberedUrlSets.delete(key);
    }
  }
}
