import type {
  ApiFormatForwardingProvider,
  ForwardingParamMapping,
  ForwardingUpstreamParam,
  StandardSchemaNode,
} from "@dafthunk/types";
import {
  buildTransformParamMappingFromSchemaNode,
  findTransformSchemaNodeById,
  findTransformSchemaNodeForMapping,
  getForwardingStandardSchema,
  resolveTransformMappingLabel,
  resolveTransformUpstreamDisplayExample,
} from "@dafthunk/types";
import { useMemo, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CredentialPlainInput } from "@/components/credential-secret-input";
import { Label } from "@/components/ui/label";
import { useAppToast } from "@/hooks/use-app-toast";
import { cn } from "@/utils/utils";

interface ForwardingMappingEditorProps {
  readonly provider: ApiFormatForwardingProvider;
  readonly upstreamParams: readonly ForwardingUpstreamParam[];
  readonly paramMappings: readonly ForwardingParamMapping[];
  readonly onUpstreamParamsChange: (
    params: readonly ForwardingUpstreamParam[]
  ) => void;
  readonly onParamMappingsChange: (
    mappings: readonly ForwardingParamMapping[]
  ) => void;
}

function formatSchemaExample(example: unknown): string {
  return JSON.stringify(example, null, 2);
}

function SchemaNodePickButton(props: {
  readonly node: StandardSchemaNode;
  readonly selected: boolean;
  readonly mapped: boolean;
  readonly onSelect: (node: StandardSchemaNode) => void;
}) {
  return (
    <button
      type="button"
      disabled={props.mapped}
      onClick={() => props.onSelect(props.node)}
      className={cn(
        "w-full rounded-md border px-3 py-2 text-left transition-colors",
        props.mapped && "cursor-not-allowed opacity-50",
        !props.mapped && "hover:bg-muted/50",
        props.selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border",
        props.mapped && "ring-1 ring-primary/20"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{props.node.label}</span>
        <Badge variant="outline">{props.node.valueType}</Badge>
      </div>
      <p className="text-muted-foreground mt-1 truncate font-mono text-xs">
        {props.node.path}
      </p>
    </button>
  );
}

function SchemaNodeExamplePanel(props: { readonly example: unknown }) {
  const { t } = useTranslation();

  return (
    <div className="bg-muted/30 space-y-1 rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-xs font-medium">
        {t("adminApiForwarding.mapping.exampleStructure")}
      </p>
      <pre className="text-muted-foreground overflow-x-auto font-mono text-xs whitespace-pre-wrap">
        {formatSchemaExample(props.example)}
      </pre>
    </div>
  );
}

export function ForwardingMappingEditor(props: ForwardingMappingEditorProps) {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const [newParamName, setNewParamName] = useState("");
  const [selectedSchemaNodeId, setSelectedSchemaNodeId] = useState<
    string | null
  >(null);

  const schemaNodes = useMemo(
    () => getForwardingStandardSchema(props.provider),
    [props.provider]
  );

  const mappingByParamId = useMemo(
    () =>
      new Map(
        props.paramMappings.map((mapping) => [mapping.upstreamParamId, mapping])
      ),
    [props.paramMappings]
  );

  const mappedSchemaNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const mapping of props.paramMappings) {
      const upstreamParam = props.upstreamParams.find(
        (param) => param.id === mapping.upstreamParamId
      );
      const node = findTransformSchemaNodeForMapping(
        mapping,
        schemaNodes,
        upstreamParam?.valueType
      );
      if (node) {
        ids.add(node.id);
      }
    }
    return ids;
  }, [props.paramMappings, props.upstreamParams, schemaNodes]);

  const selectedSchemaNode = selectedSchemaNodeId
    ? findTransformSchemaNodeById(selectedSchemaNodeId)
    : undefined;

  const paramNamePlaceholder = selectedSchemaNode
    ? t("adminApiForwarding.mapping.paramNamePlaceholderExample")
    : t("adminApiForwarding.mapping.paramNamePlaceholderSelectFirst");

  const handleAddParam = () => {
    if (!selectedSchemaNode) {
      appToast.errorRaw(t("adminApiForwarding.mapping.selectStandardFirst"));
      return;
    }

    const trimmed = newParamName.trim();
    if (!trimmed) {
      return;
    }
    if (props.upstreamParams.some((param) => param.name === trimmed)) {
      return;
    }

    const param: ForwardingUpstreamParam = {
      id: crypto.randomUUID(),
      name: trimmed,
      valueType: selectedSchemaNode.valueType,
    };

    props.onUpstreamParamsChange([param, ...props.upstreamParams]);
    props.onParamMappingsChange([
      ...props.paramMappings,
      buildTransformParamMappingFromSchemaNode(param.id, selectedSchemaNode),
    ]);
    setNewParamName("");
    setSelectedSchemaNodeId(null);
  };

  const handleRemoveParam = (paramId: string) => {
    props.onUpstreamParamsChange(
      props.upstreamParams.filter((param) => param.id !== paramId)
    );
    props.onParamMappingsChange(
      props.paramMappings.filter(
        (mapping) => mapping.upstreamParamId !== paramId
      )
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4 rounded-lg border bg-background p-4">
        <div>
          <h3 className="font-medium">
            {t("adminApiForwarding.mapping.upstreamParams")}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t("adminApiForwarding.mapping.upstreamParamsHelp")}
          </p>
        </div>

        <div className="bg-muted/30 space-y-2 rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">
            {t("adminApiForwarding.mapping.selectStandardHint")}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[140px] flex-1 space-y-1">
              <Label htmlFor="forwarding_new_param_name">
                {t("adminApiForwarding.mapping.paramName")}
              </Label>
              <CredentialPlainInput
                id="forwarding_new_param_name"
                name="forwarding_new_param_name"
                value={newParamName}
                onChange={(event) => setNewParamName(event.target.value)}
                placeholder={paramNamePlaceholder}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!selectedSchemaNode}
              onClick={handleAddParam}
            >
              {t("adminApiForwarding.mapping.addParam")}
            </Button>
          </div>
          {selectedSchemaNode ? (
            <p className="text-xs">
              {t("adminApiForwarding.mapping.selectedStandard")}：
              <span className="text-foreground font-medium">
                {selectedSchemaNode.label}
              </span>
            </p>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-md border">
          <div className="bg-muted/40 text-muted-foreground grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_auto] gap-2 border-b px-3 py-2 text-xs font-medium">
            <span>{t("adminApiForwarding.mapping.paramName")}</span>
            <span>{t("adminApiForwarding.mapping.paramType")}</span>
            <span>{t("adminApiForwarding.mapping.mappingTarget")}</span>
            <span className="sr-only">{t("common.delete")}</span>
          </div>
          {props.upstreamParams.length === 0 ? (
            <p className="text-muted-foreground px-3 py-4 text-sm">
              {t("adminApiForwarding.mapping.noParams")}
            </p>
          ) : (
            props.upstreamParams.map((param) => {
              const mapping = mappingByParamId.get(param.id);
              const mappingLabel = resolveTransformMappingLabel(
                mapping,
                schemaNodes,
                param.valueType
              );
              return (
                <div
                  key={param.id}
                  className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_auto] items-center gap-2 border-b px-3 py-2 last:border-b-0"
                >
                  <span className="truncate font-mono text-sm">{param.name}</span>
                  <Badge variant="outline" className="w-fit">
                    {param.valueType}
                  </Badge>
                  <span className="text-muted-foreground truncate text-sm">
                    {mappingLabel ??
                      t("adminApiForwarding.mapping.unmapped")}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveParam(param.id)}
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-lg border bg-background p-4">
        <div>
          <h3 className="font-medium">
            {t("adminApiForwarding.mapping.standardSchema")}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t("adminApiForwarding.mapping.standardSchemaPickHelp")}
          </p>
        </div>

        <div className="space-y-2">
          {schemaNodes.map((node) => {
            const selected = selectedSchemaNodeId === node.id;
            return (
              <div key={node.id} className="space-y-2">
                <SchemaNodePickButton
                  node={node}
                  selected={selected}
                  mapped={mappedSchemaNodeIds.has(node.id)}
                  onSelect={(entry) => setSelectedSchemaNodeId(entry.id)}
                />
                {selected ? (
                  <SchemaNodeExamplePanel
                    example={resolveTransformUpstreamDisplayExample(node)}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
