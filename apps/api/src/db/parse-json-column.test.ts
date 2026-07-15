import { describe, expect, it } from "vitest";

import { parseJsonColumn } from "./parse-json-column";

describe("parseJsonColumn", () => {
  it("parses JSON strings", () => {
    expect(parseJsonColumn<{ schemaVersion: number }>('{"schemaVersion":1}')).toEqual({
      schemaVersion: 1,
    });
  });

  it("returns objects unchanged", () => {
    const value = { schemaVersion: 1, keywordsMaxChars: 32_000 };
    expect(parseJsonColumn(value)).toBe(value);
  });
});
