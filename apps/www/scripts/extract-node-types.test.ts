import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { findNodeTypeDeclaration } from "./extract-node-types";

const scriptsDir = fileURLToPath(new URL(".", import.meta.url));
const aiNodesDir = join(
  scriptsDir,
  "../../../packages/runtime/src/nodes/ai"
);

describe("findNodeTypeDeclaration", () => {
  it.each(["ai-text-node.ts", "ai-image-node.ts", "ai-video-node.ts", "ai-audio-node.ts"])(
    "extracts nodeType from %s",
    (fileName) => {
      const content = readFileSync(join(aiNodesDir, fileName), "utf8");
      const nodeTypeBlock = findNodeTypeDeclaration(content);

      expect(nodeTypeBlock).not.toBeNull();
      expect(nodeTypeBlock).toContain('id:');
      expect(nodeTypeBlock).toContain('type:');
    }
  );
});
