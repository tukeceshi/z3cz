/** Max excerpt length stored in workflow JSON for text cards / history. */
export const AI_TEXT_EXCERPT_MAX_CHARS = 200 as const;

export const AI_TEXT_PLAIN_MIME = "text/plain; charset=utf-8" as const;
export const AI_TEXT_MARKDOWN_MIME = "text/markdown; charset=utf-8" as const;

export function buildAiTextExcerpt(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= AI_TEXT_EXCERPT_MAX_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, AI_TEXT_EXCERPT_MAX_CHARS)}…`;
}

export function inferAiTextMimeType(text: string): string {
  if (/^#{1,6}\s/m.test(text) || /\*\*[^*]+\*\*/.test(text) || /^\s*[-*]\s/m.test(text)) {
    return AI_TEXT_MARKDOWN_MIME;
  }
  return AI_TEXT_PLAIN_MIME;
}
