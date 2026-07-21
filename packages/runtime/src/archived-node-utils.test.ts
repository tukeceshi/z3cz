import { describe, expect, it } from "vitest";

import { buildCatalogAllowedNodeTypeSet } from "@dafthunk/types";

import {
  assertWorkflowExecutableAgainstCatalog,
  detectArchivedWorkflow,
} from "./archived-node-utils";

describe("archived-node-utils", () => {
  const allowed = buildCatalogAllowedNodeTypeSet([
    { type: "ai-text" },
    { type: "ai-image" },
    { type: "ai-video" },
  ]);

  it("detects nodes missing from the catalog", () => {
    const result = detectArchivedWorkflow(
      [
        { id: "1", type: "ai-text" },
        { id: "2", type: "http-request" },
      ],
      allowed
    );

    expect(result.hasArchived).toBe(true);
    expect(result.archivedNodeIds).toEqual(["2"]);
    expect(result.archivedNodes[0]?.nodeType).toBe("http-request");
  });

  it("allows workflows with only catalog nodes", () => {
    const result = detectArchivedWorkflow(
      [{ id: "1", type: "ai-image" }],
      allowed
    );

    expect(result.hasArchived).toBe(false);
    expect(() =>
      assertWorkflowExecutableAgainstCatalog(result.archivedNodes, allowed)
    ).not.toThrow();
  });

  it("treats ai-interface as allowed when omitted from panel catalog", () => {
    const result = detectArchivedWorkflow(
      [{ id: "1", type: "ai-interface" }],
      allowed
    );

    expect(result.hasArchived).toBe(false);
  });

  it("rejects execution when archived nodes are present", () => {
    expect(() =>
      assertWorkflowExecutableAgainstCatalog(
        [{ id: "1", type: "database-query" }],
        allowed
      )
    ).toThrow(/archived node types/i);
  });
});
