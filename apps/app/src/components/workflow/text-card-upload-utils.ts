import { AI_TEXT_HARD_OUTPUT_MAX_CHARS } from "./ai-text-node-utils";

export const TEXT_CARD_UPLOAD_ACCEPT =
  ".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const TEXT_CARD_UPLOAD_DISPLAY_TYPES = "TXT、MD、DOCX";

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

export type TextCardUploadFileKind = "text" | "docx" | "legacy-doc" | "unsupported";

export function classifyTextCardUploadFile(file: File): TextCardUploadFileKind {
  const ext = fileExtension(file.name);
  const mime = file.type.split(";")[0]?.trim().toLowerCase() ?? "";

  if (ext === ".doc") {
    return "legacy-doc";
  }

  if (
    ext === ".docx" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }

  if (
    ext === ".txt" ||
    ext === ".md" ||
    ext === ".markdown" ||
    mime === "text/plain" ||
    mime === "text/markdown"
  ) {
    return "text";
  }

  return "unsupported";
}

export function canTextCardUpload(params: {
  readonly hasOutput: boolean;
  readonly isGenerating: boolean;
  readonly disabled?: boolean;
  readonly uploading?: boolean;
}): boolean {
  if (params.disabled || params.uploading) {
    return false;
  }
  if (params.hasOutput || params.isGenerating) {
    return false;
  }
  return true;
}

export function assertTextCardUploadLength(text: string): void {
  if (text.length > AI_TEXT_HARD_OUTPUT_MAX_CHARS) {
    throw new Error("text_too_long");
  }
}
