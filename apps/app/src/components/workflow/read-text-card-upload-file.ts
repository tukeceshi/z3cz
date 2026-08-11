import { normalizeImportedTextMarkdown } from "./normalize-imported-text-markdown";
import {
  assertTextCardUploadLength,
  classifyTextCardUploadFile,
} from "./text-card-upload-utils";

export type TextCardUploadReadError =
  | "legacy-doc"
  | "unsupported"
  | "read_failed"
  | "empty_file"
  | "text_too_long";

async function readPlainTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (!utf8.includes("\uFFFD")) {
    return utf8;
  }

  try {
    return new TextDecoder("gb18030").decode(buffer);
  } catch {
    return utf8;
  }
}

async function readDocxMarkdown(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();

  // Vitest/Node uses lib/unzip (buffer); browser uses browser/unzip (arrayBuffer).
  if (typeof window === "undefined") {
    const converted = await mammoth.convertToMarkdown({
      buffer: Buffer.from(arrayBuffer),
    });
    return converted.value;
  }

  const converted = await mammoth.convertToMarkdown({ arrayBuffer });
  return converted.value;
}

export async function readTextCardUploadFile(
  file: File
): Promise<{ readonly ok: true; readonly text: string } | { readonly ok: false; readonly error: TextCardUploadReadError }> {
  const kind = classifyTextCardUploadFile(file);

  if (kind === "legacy-doc") {
    return { ok: false, error: "legacy-doc" };
  }

  if (kind === "unsupported") {
    return { ok: false, error: "unsupported" };
  }

  try {
    const raw =
      kind === "docx" ? await readDocxMarkdown(file) : await readPlainTextFile(file);

    if (!raw.trim()) {
      return { ok: false, error: "empty_file" };
    }

    const normalized = normalizeImportedTextMarkdown(raw);
    assertTextCardUploadLength(normalized);
    return { ok: true, text: normalized };
  } catch (error) {
    if (error instanceof Error && error.message === "text_too_long") {
      return { ok: false, error: "text_too_long" };
    }
    return { ok: false, error: "read_failed" };
  }
}
