const FULLWIDTH_PIPE = "\uFF5C";

/** Preview-only: treat fullwidth column pipes like ASCII `|` before parsing. */
export function normalizeTableMarkdownForDisplay(markdown: string): string {
  if (!markdown.includes(FULLWIDTH_PIPE)) {
    return markdown;
  }
  return markdown.replaceAll(FULLWIDTH_PIPE, "|");
}
