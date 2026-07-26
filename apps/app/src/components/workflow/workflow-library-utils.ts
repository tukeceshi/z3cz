export function hasLibraryCover(
  coverObjectId?: string | null,
  coverMimeType?: string | null
): boolean {
  return Boolean(coverObjectId && coverMimeType);
}
