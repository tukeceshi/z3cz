import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NodeType } from "@dafthunk/types";

const apiRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

const nodesJsonCandidates = [
  path.join(apiRoot, "..", "www", "data", "nodes.json"),
  path.join(apiRoot, "data", "nodes.json"),
];

let cachedNodeTypes: NodeType[] | null = null;
let cachedNodesJsonPath: string | null = null;
let cachedNodesJsonMtimeMs = 0;

function resolveNodesJsonPath(): string | null {
  for (const candidate of nodesJsonCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function loadNodeTypesFromJson(): NodeType[] {
  const nodesJsonPath = resolveNodesJsonPath();
  if (!nodesJsonPath) {
    throw new Error(
      "nodes.json not found for Node runtime type listing. Run: pnpm --filter '@dafthunk/www' extract-nodes"
    );
  }

  const mtimeMs = fs.statSync(nodesJsonPath).mtimeMs;
  if (
    cachedNodeTypes &&
    cachedNodesJsonPath === nodesJsonPath &&
    cachedNodesJsonMtimeMs === mtimeMs
  ) {
    return cachedNodeTypes;
  }

  const parsed = JSON.parse(fs.readFileSync(nodesJsonPath, "utf8")) as Record<
    string,
    NodeType
  >;
  cachedNodeTypes = Object.values(parsed);
  cachedNodesJsonPath = nodesJsonPath;
  cachedNodesJsonMtimeMs = mtimeMs;
  return cachedNodeTypes;
}
