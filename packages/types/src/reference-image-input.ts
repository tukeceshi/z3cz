/** Base64 image payload for upstream when no public URL exists (local staging). */
export interface ReferenceImageInline {
  readonly mimeType: string;
  readonly data: string;
}

export function formatReferenceImageInline(inline: ReferenceImageInline): string {
  return `data:${inline.mimeType};base64,${inline.data}`;
}

/** Merge URL and inline references into Volcano `image` field values. */
export function mergeReferenceImageValues(params: {
  readonly referenceImageUrls?: readonly string[];
  readonly referenceImageInline?: readonly ReferenceImageInline[];
}): readonly string[] {
  const values: string[] = [];
  for (const url of params.referenceImageUrls ?? []) {
    const trimmed = url.trim();
    if (trimmed) values.push(trimmed);
  }
  for (const inline of params.referenceImageInline ?? []) {
    if (inline.data.trim()) {
      values.push(formatReferenceImageInline(inline));
    }
  }
  return values;
}

export function assignReferenceImagesToBody(
  body: Record<string, unknown>,
  values: readonly string[]
): void {
  if (values.length === 1) {
    body.image = values[0];
    return;
  }
  if (values.length > 1) {
    body.image = values;
  }
}
