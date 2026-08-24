const FULLWIDTH_PIPE = "\uFF5C";

/** Treat fullwidth `|` like ASCII `|` when reading body and drawing tables. */
export function normalizeTableMarkdownForDisplay(markdown: string): string {
  if (!markdown.includes(FULLWIDTH_PIPE)) {
    return markdown;
  }
  return markdown.replaceAll(FULLWIDTH_PIPE, "|");
}
