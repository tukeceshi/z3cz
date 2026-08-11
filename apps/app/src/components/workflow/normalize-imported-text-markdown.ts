import { normalizeTableMarkdownForDisplay } from "./normalize-table-markdown-for-display";

/** Import-time cleanup so studio formatted view can parse headings and tables. */
export function normalizeImportedTextMarkdown(markdown: string): string {
  const withoutBom = markdown.replace(/^\uFEFF/, "");
  const normalizedLines = withoutBom
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/^# (?!#)/gm, "## ");

  return normalizeTableMarkdownForDisplay(normalizedLines);
}
