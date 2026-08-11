import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readTextCardUploadFile } from "./read-text-card-upload-file";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const mammothFixture = path.resolve(
  testDir,
  "../../../node_modules/mammoth/test/test-data/simple-list.docx"
);

function fileFromString(name: string, content: string, type = ""): File {
  return new File([content], name, { type });
}

describe("readTextCardUploadFile", () => {
  it("reads utf-8 text and markdown", async () => {
    const txt = await readTextCardUploadFile(
      fileFromString("note.txt", "第一行\n第二行", "text/plain")
    );
    expect(txt).toEqual({ ok: true, text: "第一行\n第二行" });

    const md = await readTextCardUploadFile(
      fileFromString("note.md", "# Title\n\nBody", "text/markdown")
    );
    expect(md).toEqual({ ok: true, text: "## Title\n\nBody" });
  });

  it("rejects legacy doc and unsupported files", async () => {
    expect(
      await readTextCardUploadFile(fileFromString("old.doc", "x"))
    ).toEqual({ ok: false, error: "legacy-doc" });
    expect(
      await readTextCardUploadFile(
        fileFromString("image.png", "x", "image/png")
      )
    ).toEqual({ ok: false, error: "unsupported" });
    expect(
      await readTextCardUploadFile(fileFromString("empty.txt", "   \n", "text/plain"))
    ).toEqual({ ok: false, error: "empty_file" });
  });

  it("reads docx via mammoth", async () => {
    const buffer = readFileSync(mammothFixture);
    const file = new File([buffer], "simple-list.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const result = await readTextCardUploadFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text.trim().length).toBeGreaterThan(0);
    }
  });
});
