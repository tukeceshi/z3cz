import { describe, expect, it } from "vitest";

import {
  buildConnectedHandleKeysByNode,
  connectedHandleKeysEqual,
} from "./workflow-connected-handles";

describe("workflow-connected-handles", () => {
  it("builds per-node handle keys from edges", () => {
    const map = buildConnectedHandleKeysByNode([
      {
        id: "e1",
        source: "a",
        target: "b",
        sourceHandle: "out",
        targetHandle: "in",
      },
    ]);

    expect(map.get("a")).toEqual(["a:out"]);
    expect(map.get("b")).toEqual(["b:in"]);
  });

  it("compares handle key arrays", () => {
    expect(connectedHandleKeysEqual(["a:1"], ["a:1"])).toBe(true);
    expect(connectedHandleKeysEqual(undefined, [])).toBe(true);
    expect(connectedHandleKeysEqual(["a:1"], ["a:2"])).toBe(false);
  });
});
