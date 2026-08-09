const HEADING_LINE_PATTERN = /^#{1,6}\s+(.+)$/;

/**
 * Resolve a node title from markdown text preceding a table.
 * Returns the nearest heading line (## ...) with `#` markers stripped.
 */
export function resolveTableReferenceTitle(
  precedingText: string
): string | undefined {
  const lines = precedingText.split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]?.trim() ?? "";
    if (!line) {
      continue;
    }
    const match = HEADING_LINE_PATTERN.exec(line);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}
