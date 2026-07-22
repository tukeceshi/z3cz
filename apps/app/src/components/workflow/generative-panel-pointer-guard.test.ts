import { describe, expect, it } from "vitest";

import {
  armGenerativePanelPointerGuard,
  shouldSuppressGenerativePanelDeselect,
} from "./generative-panel-pointer-guard";

describe("generative-panel-pointer-guard", () => {
  it("suppresses deselect only for the armed node during pointer interaction", () => {
    armGenerativePanelPointerGuard("node-a");
    expect(shouldSuppressGenerativePanelDeselect("node-a")).toBe(true);
    expect(shouldSuppressGenerativePanelDeselect("node-b")).toBe(false);
  });
});
