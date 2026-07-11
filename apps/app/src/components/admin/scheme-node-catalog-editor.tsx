import type {
  NodeType,
  WorkflowSchemeNodeRules,
  WorkflowTrigger,
} from "@dafthunk/types";
import { useMemo, useState } from "react";

import { getTriggerNodeTypes } from "@/components/workflow/trigger-node-mapping";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TranslateFn } from "@/i18n";
import { cn } from "@/utils/utils";

export interface SchemeNodeCatalogValue {
  unrestricted: boolean;
  includeTags: string[];
  includeNodeTypes: string[];
  excludeNodeTypes: string;
}

interface SchemeNodeCatalogEditorProps {
  nodeTypes: NodeType[];
  allowedTriggers: WorkflowTrigger[];
  value: SchemeNodeCatalogValue;
  onChange: (value: SchemeNodeCatalogValue) => void;
}

function parseExcludeNodeTypes(excludeNodeTypes: string): string[] {
  return excludeNodeTypes
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function valueToNodeRules(value: SchemeNodeCatalogValue): WorkflowSchemeNodeRules {
  const excludeNodeTypes = parseExcludeNodeTypes(value.excludeNodeTypes);

  if (value.unrestricted) {
    return {
      includeTags: [],
      includeNodeTypes: [],
      excludeNodeTypes,
    };
  }

  return {
    includeTags: value.includeTags,
    includeNodeTypes: value.includeNodeTypes,
    excludeNodeTypes,
  };
}

function isSchemeNodeCatalogUnrestricted(
  nodeRules: WorkflowSchemeNodeRules
): boolean {
  const hasIncludeTags = (nodeRules.includeTags?.length ?? 0) > 0;
  const hasIncludeNodeTypes = (nodeRules.includeNodeTypes?.length ?? 0) > 0;
  return !hasIncludeTags && !hasIncludeNodeTypes;
}

function filterNodeTypesByScheme(
  allNodeTypes: NodeType[],
  nodeRules: WorkflowSchemeNodeRules
): NodeType[] {
  const exclude = new Set(nodeRules.excludeNodeTypes ?? []);
  const alwaysInclude = new Set(nodeRules.alwaysIncludeNodeTypes ?? []);

  if (isSchemeNodeCatalogUnrestricted(nodeRules)) {
    if (exclude.size === 0) {
      return allNodeTypes;
    }
    return allNodeTypes.filter(
      (nodeType) =>
        alwaysInclude.has(nodeType.type) || !exclude.has(nodeType.type)
    );
  }

  const includeTags = new Set(nodeRules.includeTags ?? []);
  const includeNodeTypes = new Set(nodeRules.includeNodeTypes ?? []);

  return allNodeTypes.filter((nodeType) => {
    if (alwaysInclude.has(nodeType.type)) {
      return true;
    }
    if (exclude.has(nodeType.type)) {
      return false;
    }
    if (includeNodeTypes.has(nodeType.type)) {
      return true;
    }
    if (nodeType.functionCalling && includeTags.has("Tools")) {
      return true;
    }
    return nodeType.tags.some((tag) => includeTags.has(tag));
  });
}

function catalogNodeTypes(nodeTypes: NodeType[]): NodeType[] {
  return nodeTypes.filter((nodeType) => !nodeType.trigger && !nodeType.responder);
}

export function summarizeSchemeNodes(
  nodeTypes: NodeType[],
  nodeRules: WorkflowSchemeNodeRules,
  t: TranslateFn
): string {
  if (isSchemeNodeCatalogUnrestricted(nodeRules)) {
    const excludeCount = nodeRules.excludeNodeTypes?.length ?? 0;
    if (excludeCount === 0) {
      return t("adminWorkflowSchemes.allNodes");
    }
    return t("adminWorkflowSchemes.allExceptTypes", { count: excludeCount });
  }

  const count = filterNodeTypesByScheme(nodeTypes, nodeRules).length;
  return t("adminWorkflowSchemes.nodeCountSummary", { count });
}

function toggleListValue(values: string[], value: string): string[] {
  const selected = new Set(values);
  if (selected.has(value)) {
    selected.delete(value);
  } else {
    selected.add(value);
  }
  return [...selected];
}

export function SchemeNodeCatalogEditor({
  nodeTypes,
  allowedTriggers,
  value,
  onChange,
}: SchemeNodeCatalogEditorProps) {
  const { t } = useTranslation();
  const [tagSearch, setTagSearch] = useState("");
  const [nodeSearch, setNodeSearch] = useState("");

  const paletteNodes = useMemo(() => catalogNodeTypes(nodeTypes), [nodeTypes]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const nodeType of paletteNodes) {
      for (const tag of nodeType.tags) {
        tags.add(tag);
      }
      if (nodeType.functionCalling) {
        tags.add("Tools");
      }
    }
    return [...tags].sort((a, b) => a.localeCompare(b));
  }, [paletteNodes]);

  const filteredTags = useMemo(() => {
    const term = tagSearch.trim().toLowerCase();
    if (!term) {
      return availableTags;
    }
    return availableTags.filter((tag) => tag.toLowerCase().includes(term));
  }, [availableTags, tagSearch]);

  const filteredNodes = useMemo(() => {
    const term = nodeSearch.trim().toLowerCase();
    if (!term) {
      return paletteNodes;
    }
    return paletteNodes.filter((nodeType) => {
      const haystack = [
        nodeType.name,
        nodeType.type,
        ...nodeType.tags,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [nodeSearch, paletteNodes]);

  const previewCount = useMemo(() => {
    const nodeRules = valueToNodeRules(value);
    const allowed = filterNodeTypesByScheme(nodeTypes, nodeRules);
    const triggerNodeIds = new Set(
      allowedTriggers.flatMap((trigger) => getTriggerNodeTypes(trigger))
    );
    const triggerNodes = nodeTypes.filter((nodeType) =>
      triggerNodeIds.has(nodeType.type)
    );
    const merged = new Map<string, NodeType>();
    for (const nodeType of [...allowed, ...triggerNodes]) {
      merged.set(nodeType.type, nodeType);
    }
    return merged.size;
  }, [allowedTriggers, nodeTypes, value]);

  const handleSelectVisibleNodes = () => {
    const visibleTypes = filteredNodes.map((nodeType) => nodeType.type);
    onChange({
      ...value,
      unrestricted: false,
      includeNodeTypes: [...new Set([...value.includeNodeTypes, ...visibleTypes])],
    });
  };

  const handleClearSelectedNodes = () => {
    onChange({
      ...value,
      includeNodeTypes: [],
    });
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <Label>{t("adminWorkflowSchemes.nodeCatalog")}</Label>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("adminWorkflowSchemes.nodeCatalogHelp")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            value.unrestricted
              ? "border-primary bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/50"
          )}
          onClick={() => onChange({ ...value, unrestricted: true })}
        >
          {t("adminWorkflowSchemes.allNodesMode")}
        </button>
        <button
          type="button"
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            !value.unrestricted
              ? "border-primary bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/50"
          )}
          onClick={() => onChange({ ...value, unrestricted: false })}
        >
          {t("adminWorkflowSchemes.customNodesMode")}
        </button>
      </div>

      {!value.unrestricted ? (
        <>
          <div>
            <Label>{t("adminWorkflowSchemes.includeTags")}</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("adminWorkflowSchemes.includeTagsHelp")}
            </p>
            <Input
              value={tagSearch}
              onChange={(event) => setTagSearch(event.target.value)}
              placeholder={t("adminWorkflowSchemes.searchTags")}
              className="mt-2"
            />
            <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {filteredTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    value.includeTags.includes(tag)
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                  onClick={() =>
                    onChange({
                      ...value,
                      includeTags: toggleListValue(value.includeTags, tag),
                    })
                  }
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>{t("adminWorkflowSchemes.includeNodeTypes")}</Label>
            <Input
              value={nodeSearch}
              onChange={(event) => setNodeSearch(event.target.value)}
              placeholder={t("adminWorkflowSchemes.searchNodes")}
              className="mt-2"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectVisibleNodes}
              >
                {t("adminWorkflowSchemes.selectVisibleNodes")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSelectedNodes}
              >
                {t("adminWorkflowSchemes.clearSelectedNodes")}
              </Button>
              <span className="self-center text-xs text-muted-foreground">
                {t("adminWorkflowSchemes.selected")}:{" "}
                {value.includeNodeTypes.length}
              </span>
            </div>
            <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
              {filteredNodes.map((nodeType) => {
                const selected = value.includeNodeTypes.includes(nodeType.type);
                return (
                  <label
                    key={nodeType.type}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50",
                      selected && "bg-primary/5"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() =>
                        onChange({
                          ...value,
                          includeNodeTypes: toggleListValue(
                            value.includeNodeTypes,
                            nodeType.type
                          ),
                        })
                      }
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">{nodeType.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {nodeType.type}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      <div>
        <Label htmlFor="scheme-exclude-node-types">
          {t("adminWorkflowSchemes.excludeNodeTypes")}
        </Label>
        <Textarea
          id="scheme-exclude-node-types"
          value={value.excludeNodeTypes}
          onChange={(event) =>
            onChange({ ...value, excludeNodeTypes: event.target.value })
          }
          className="mt-2 font-mono text-xs"
          rows={4}
          placeholder="deprecated-node&#10;legacy-node"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {t("adminWorkflowSchemes.triggerNodesHint")}
      </p>
      <p className="text-sm font-medium">
        {t("adminWorkflowSchemes.nodePreview", { summary: previewCount })}
      </p>
    </div>
  );
}
