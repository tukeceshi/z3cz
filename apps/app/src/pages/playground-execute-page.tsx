import type { ExecuteNodeResponse, ParameterValue } from "@dafthunk/types";
import { DynamicIcon, iconNames } from "lucide-react/dynamic.mjs";
import CircleHelp from "lucide-react/icons/circle-help";
import Play from "lucide-react/icons/play";
import { createElement, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { NodeDocsDialog } from "@/components/docs/node-docs-dialog";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { OrgPermissionGate } from "@/components/org-permission-gate";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { PropertyField } from "@/components/workflow/fields/property-field";
import { registry } from "@/components/workflow/widgets";
import { convertValueByType } from "@/components/workflow/workflow-context";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { useOrgUrl } from "@/hooks/use-org-url";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import { useObjectService } from "@/services/object-service";
import { executeNode } from "@/services/playground-service";
import { useNodeTypes } from "@/services/type-service";

export function PlaygroundExecutePage() {
  const { t } = useTranslation();
  const perms = useOrgPermissions();

  if (!perms.canAccessModelCalls) {
    return (
      <OrgPermissionGate allowed={false} title={t("sidebar.playground")}>
        {null}
      </OrgPermissionGate>
    );
  }

  return <PlaygroundExecutePageContent />;
}

function PlaygroundExecutePageContent() {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const orgId = organization?.id || "";
  const { nodeType: nodeTypeParam } = useParams<{ nodeType: string }>();
  const { nodeTypes, isNodeTypesLoading } = useNodeTypes();
  const { createObjectUrl } = useObjectService();
  const { getOrgUrl } = useOrgUrl();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);

  const selectedNodeType = useMemo(
    () => nodeTypes.find((nt) => nt.type === nodeTypeParam) ?? null,
    [nodeTypes, nodeTypeParam]
  );

  useEffect(() => {
    setBreadcrumbs([
      { label: t("pages.playground.title"), to: getOrgUrl("playground") },
      { label: selectedNodeType?.name ?? nodeTypeParam ?? "" },
    ]);
  }, [setBreadcrumbs, getOrgUrl, selectedNodeType?.name, nodeTypeParam, t]);

  const [inputValues, setInputValues] = useState<Record<string, unknown>>({});
  const [defaultsInitialized, setDefaultsInitialized] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ExecuteNodeResponse | null>(null);

  if (selectedNodeType && !defaultsInitialized) {
    const defaults: Record<string, unknown> = {};
    for (const input of selectedNodeType.inputs) {
      if (input.value !== undefined) {
        defaults[input.name] = input.value;
      }
    }
    setInputValues(defaults);
    setDefaultsInitialized(true);
  }

  const handleInputChange = (name: string, value: unknown, type: string) => {
    const typedValue = convertValueByType(value as string, type);
    setInputValues((prev) => ({ ...prev, [name]: typedValue }));
  };

  const handleInputClear = (name: string) => {
    setInputValues((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const workflowInputs = useMemo(
    () =>
      selectedNodeType
        ? selectedNodeType.inputs.map((input) => ({
            ...input,
            id: input.name,
            value: inputValues[input.name] ?? input.value,
          }))
        : [],
    [selectedNodeType, inputValues]
  );

  const workflowOutputs = useMemo(
    () =>
      selectedNodeType
        ? selectedNodeType.outputs.map((output) => ({
            ...output,
            id: output.name,
            value:
              result?.status === "completed"
                ? result.outputs?.[output.name]
                : undefined,
          }))
        : [],
    [selectedNodeType, result]
  );

  const widget = selectedNodeType
    ? registry.for(
        selectedNodeType.type,
        selectedNodeType.type,
        workflowInputs,
        workflowOutputs,
        selectedNodeType.metadata
      )
    : null;

  const handleWidgetChange = (value: unknown) => {
    if (!widget) return;
    setInputValues((prev) => ({ ...prev, [widget.inputField]: value }));
  };

  const handleExecute = async () => {
    if (!selectedNodeType || !orgId) return;
    setIsExecuting(true);
    setResult(null);
    try {
      const response = await executeNode(
        selectedNodeType.type,
        inputValues as Record<string, ParameterValue>,
        orgId
      );
      setResult(response);
    } catch (error) {
      setResult({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : t("pages.playgroundExecute.executionFailed"),
        usage: 0,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  if (isNodeTypesLoading) {
    return (
      <InsetLayout title={t("pages.playground.title")}>
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      </InsetLayout>
    );
  }

  if (!selectedNodeType) {
    return (
      <InsetLayout title={t("pages.playground.title")}>
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">
            {t("pages.playgroundExecute.nodeNotFound", {
              type: nodeTypeParam ?? "",
            })}
          </p>
        </div>
      </InsetLayout>
    );
  }

  const visibleInputs = workflowInputs;

  return (
    <InsetLayout title={t("pages.playground.title")}>
      <div className="space-y-6">
        <div className="flex items-center gap-3 border rounded-lg p-4 bg-card">
          <DynamicIcon
            name={
              iconNames.includes(selectedNodeType.icon as never)
                ? selectedNodeType.icon
                : "file-question"
            }
            className="h-6 w-6 text-blue-500 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base">{selectedNodeType.name}</h2>
            {selectedNodeType.description && (
              <p className="text-sm text-muted-foreground">
                {selectedNodeType.description}
              </p>
            )}
          </div>
          <Button variant="outline" onClick={() => setIsDocsOpen(true)}>
            <CircleHelp className="mr-2 size-4" />
            {t("pages.playgroundExecute.help")}
          </Button>
          <Button onClick={handleExecute} disabled={isExecuting}>
            {isExecuting ? (
              <>
                <Spinner className="mr-2" />
                {t("pages.playgroundExecute.executing")}
              </>
            ) : (
              <>
                <Play className="mr-2 size-4" />
                {t("pages.playgroundExecute.execute")}
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {t("pages.playgroundExecute.inputs")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {visibleInputs.length > 0 ? (
                visibleInputs.map((input) =>
                  widget && input.id === widget.inputField ? (
                    <div
                      key={input.id}
                      className="text-sm space-y-1 [&_button]:h-9 [&_button]:text-sm [&_select]:h-9 [&_select]:text-sm"
                    >
                      <span className="text-foreground font-medium font-mono">
                        {input.name}
                        {input.required && (
                          <span className="text-red-500 dark:text-red-400 ml-0.5">
                            *
                          </span>
                        )}
                      </span>
                      {createElement(widget.Component, {
                        ...widget.config,
                        onChange: handleWidgetChange,
                        createObjectUrl,
                        className: "p-0",
                      })}
                    </div>
                  ) : (
                    <PropertyField
                      key={input.id}
                      parameter={input}
                      value={input.value}
                      onChange={(value) =>
                        handleInputChange(input.name, value, input.type)
                      }
                      onClear={() => handleInputClear(input.name)}
                      createObjectUrl={createObjectUrl}
                    />
                  )
                )
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("pages.playgroundExecute.noInputs")}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {t("pages.playgroundExecute.outputs")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {workflowOutputs.length > 0 ? (
                workflowOutputs.map((output) => (
                  <PropertyField
                    key={output.id}
                    parameter={output}
                    value={output.value}
                    onChange={() => {}}
                    onClear={() => {}}
                    disabled
                    createObjectUrl={createObjectUrl}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("pages.playgroundExecute.noOutputs")}
                </p>
              )}
            </CardContent>
          </Card>

          {result?.status === "error" && result.error && (
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t("pages.playgroundExecute.error")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {result.error}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <NodeDocsDialog
        nodeType={selectedNodeType}
        isOpen={isDocsOpen}
        onOpenChange={setIsDocsOpen}
      />
    </InsetLayout>
  );
}
