/**
 * Extract node type metadata from API nodes into a single JSON file.
 *
 * Usage: npx tsx scripts/extract-node-types.ts
 *
 * Output: data/nodes.json (flat map of node ID -> metadata)
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface NodeType {
  id: string;
  name: string;
  type: string;
  tags: string[];
  icon: string;
  description?: string;
  documentation?: string;
  referenceUrl?: string;
  usage?: number;
  inputs: {
    name: string;
    type: string;
    description?: string;
    required?: boolean;
  }[];
  outputs: {
    name: string;
    type: string;
    description?: string;
  }[];
}

const API_NODES_DIR = join(__dirname, "../../../packages/runtime/src/nodes");
const OUTPUT_PATH = join(__dirname, "../data/nodes.json");

function main() {
  const nodes: Record<string, NodeType> = {};

  // Get all subdirectories in the nodes folder
  const categories = readdirSync(API_NODES_DIR).filter((name) => {
    const path = join(API_NODES_DIR, name);
    return statSync(path).isDirectory();
  });

  console.log(`Scanning ${categories.length} node categories...`);

  for (const category of categories) {
    const categoryDir = join(API_NODES_DIR, category);
    const nodeFiles = readdirSync(categoryDir).filter(
      (f) =>
        f.endsWith("-node.ts") &&
        !f.includes(".test.") &&
        !f.includes(".integration.")
    );

    for (const file of nodeFiles) {
      const filePath = join(categoryDir, file);
      const content = readFileSync(filePath, "utf-8");

      const nodeTypeMatch = content.match(
        /static\s+readonly\s+nodeType:\s*NodeType\s*=\s*(\{[\s\S]*?\n\s*\});/
      );

      if (!nodeTypeMatch) continue;

      try {
        const nodeTypeStr = nodeTypeMatch[1];

        const id = extractStringField(nodeTypeStr, "id", content);
        const name = extractStringField(nodeTypeStr, "name", content);
        if (!id || !name) continue;

        const type = extractStringField(nodeTypeStr, "type", content);
        const description = extractStringField(nodeTypeStr, "description", content);
        const documentation = extractStringField(
          nodeTypeStr,
          "documentation",
          content
        );
        const icon = extractStringField(nodeTypeStr, "icon", content);
        const referenceUrl = extractStringField(
          nodeTypeStr,
          "referenceUrl",
          content
        );
        const tags = extractArrayField(nodeTypeStr, "tags");
        const usage = extractNumberField(nodeTypeStr, "usage");
        const inputs = extractParametersField(nodeTypeStr, "inputs");
        const outputs = extractParametersField(nodeTypeStr, "outputs");

        nodes[id] = {
          id,
          name,
          type: type || id,
          tags: tags || [],
          icon: icon || "box",
          description,
          documentation,
          referenceUrl,
          usage,
          inputs: inputs || [],
          outputs: outputs || [],
        };
      } catch (error) {
        console.error(`Error parsing ${file}:`, error);
      }
    }
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(nodes, null, 2));
  console.log(`Extracted ${Object.keys(nodes).length} nodes to ${OUTPUT_PATH}`);
}

function extractStringField(
  content: string,
  field: string,
  fullFileContent?: string
): string | undefined {
  const patterns = [
    new RegExp(`${field}:\\s*"([^"]*)"`, "s"),
    new RegExp(`${field}:\\s*'([^']*)'`, "s"),
    new RegExp(`${field}:\\s*\`([^\`]*)\``, "s"),
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
  }

  // Resolve `id: SOME_CONST` / `type: SOME_CONST` via nearby
  // `export const SOME_CONST = "literal"` declarations in the same file.
  if (fullFileContent) {
    const constRef = content.match(
      new RegExp(`${field}:\\s*([A-Z][A-Z0-9_]*)`)
    );
    if (constRef) {
      const constName = constRef[1];
      const constDef = fullFileContent.match(
        new RegExp(
          `(?:export\\s+)?const\\s+${constName}\\s*=\\s*["'\`]([^"'\`]+)["'\`]`
        )
      );
      if (constDef) return constDef[1];
    }
  }

  return undefined;
}

function extractNumberField(
  content: string,
  field: string
): number | undefined {
  const match = content.match(new RegExp(`${field}:\\s*(\\d+)`));
  return match ? parseInt(match[1], 10) : undefined;
}

function extractArrayField(
  content: string,
  field: string
): string[] | undefined {
  const match = content.match(new RegExp(`${field}:\\s*\\[([^\\]]+)\\]`));
  if (!match) return undefined;

  const strings = match[1].match(/["'`]([^"'`]+)["'`]/g);
  if (!strings) return [];

  return strings.map((s) => s.slice(1, -1));
}

function extractParametersField(
  content: string,
  field: string
):
  | { name: string; type: string; description?: string; required?: boolean }[]
  | undefined {
  const fieldStart = content.indexOf(`${field}:`);
  if (fieldStart === -1) return undefined;

  const bracketStart = content.indexOf("[", fieldStart);
  if (bracketStart === -1) return undefined;

  let depth = 0;
  let bracketEnd = bracketStart;
  for (let i = bracketStart; i < content.length; i++) {
    if (content[i] === "[") depth++;
    if (content[i] === "]") depth--;
    if (depth === 0) {
      bracketEnd = i;
      break;
    }
  }

  const arrayContent = content.slice(bracketStart, bracketEnd + 1);
  const params: {
    name: string;
    type: string;
    description?: string;
    required?: boolean;
  }[] = [];

  const objectMatches = arrayContent.matchAll(/\{([^}]+)\}/g);
  for (const objMatch of objectMatches) {
    const objContent = objMatch[1];
    const name = extractStringField(objContent, "name");
    const type = extractStringField(objContent, "type");
    const description = extractStringField(objContent, "description");
    const requiredMatch = objContent.match(/required:\s*(true|false)/);
    const required = requiredMatch ? requiredMatch[1] === "true" : undefined;

    if (name && type) {
      params.push({ name, type, description, required });
    }
  }

  return params;
}

main();
