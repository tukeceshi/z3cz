import { describe, expect, it } from "vitest";

import {
  canTextCardUpload,
  classifyTextCardUploadFile,
} from "./text-card-upload-utils";

describe("classifyTextCardUploadFile", () => {
  it("accepts plain text and markdown by extension or mime", () => {
    expect(
      classifyTextCardUploadFile(
        new File(["hello"], "notes.txt", { type: "text/plain" })
      )
    ).toBe("text");
    expect(
      classifyTextCardUploadFile(
        new File(["# hi"], "readme.md", { type: "text/markdown" })
      )
    ).toBe("text");
    expect(
      classifyTextCardUploadFile(new File(["x"], "outline.markdown", { type: "" }))
    ).toBe("text");
  });

  it("accepts docx by extension or mime", () => {
    expect(
      classifyTextCardUploadFile(
        new File(["x"], "script.docx", {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        })
      )
    ).toBe("docx");
    expect(
      classifyTextCardUploadFile(new File(["x"], "script.docx", { type: "" }))
    ).toBe("docx");
  });

  it("rejects legacy doc and unknown types", () => {
    expect(
      classifyTextCardUploadFile(new File(["x"], "legacy.doc", { type: "" }))
    ).toBe("legacy-doc");
    expect(
      classifyTextCardUploadFile(new File(["x"], "photo.png", { type: "image/png" }))
    ).toBe("unsupported");
  });
});

describe("canTextCardUpload", () => {
  it("allows upload only on empty idle cards", () => {
    expect(
      canTextCardUpload({ hasOutput: false, isGenerating: false })
    ).toBe(true);
    expect(
      canTextCardUpload({ hasOutput: true, isGenerating: false })
    ).toBe(false);
    expect(
      canTextCardUpload({ hasOutput: false, isGenerating: true })
    ).toBe(false);
    expect(
      canTextCardUpload({
        hasOutput: false,
        isGenerating: false,
        disabled: true,
      })
    ).toBe(false);
  });
});
