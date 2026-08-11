import { describe, expect, it } from "vitest";

import {
  applyTextEditOps,
  diffTextToOps,
  sha256HexFromText,
} from "./text-content-utils";

describe("text-content-utils", () => {
  it("hashes utf-8 text consistently", () => {
    expect(sha256HexFromText("hello")).toHaveLength(64);
    expect(sha256HexFromText("你好")).not.toBe(sha256HexFromText("hello"));
  });

  it("applies append and replace ops", () => {
    const base = new TextEncoder().encode("abc");
    const merged = applyTextEditOps(base, [
      { op: "append", text: "d" },
      { op: "replace", start: 1, end: 2, text: "Z" },
    ]);
    expect(new TextDecoder().decode(merged)).toBe("aZcd");
  });

  it("diffs append-only edits", () => {
    expect(diffTextToOps("abc", "abcd")).toEqual([{ op: "append", text: "d" }]);
  });
});
