import Check from "lucide-react/icons/check";
import Loader2 from "lucide-react/icons/loader-2";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";

import {
  isFormValid,
  SchemaFieldInput,
  type SchemaFormField,
  submitSchemaForm,
} from "@/components/forms/schema-form";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getApiBaseUrl } from "@/config/api";
import type { TranslateFn } from "@/i18n";

interface FormConfig {
  title: string;
  description?: string;
  fields: SchemaFormField[];
  mode: "request" | "webhook";
}

interface FormResponse {
  fields: SchemaFormField[];
  record: Record<string, unknown>;
}

type FormState =
  | { status: "loading" }
  | { status: "ready"; config: FormConfig }
  | { status: "submitting"; config: FormConfig }
  | { status: "success"; mode: "request" | "webhook"; response?: FormResponse }
  | { status: "error"; message: string };

function formatResponseValue(value: unknown, t: TranslateFn): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? t("pages.form.yes") : t("pages.form.no");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Public page for a form-trigger workflow. Renders the form from the trigger
 * node's schema and submits it to start the workflow. Unlike the HITL form,
 * it can be submitted repeatedly.
 */
export function FormTriggerPage() {
  const { t } = useTranslation();
  const { workflowId } = useParams<{ workflowId: string }>();
  const [state, setState] = useState<FormState>({ status: "loading" });
  const [values, setValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!workflowId) {
      setState({ status: "error", message: t("pages.form.invalidLink") });
      return;
    }

    const apiBaseUrl = getApiBaseUrl();
    fetch(`${apiBaseUrl}/form-triggers/${workflowId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error || t("pages.form.loadFailed")
          );
        }
        return res.json();
      })
      .then((config: FormConfig) => {
        const defaults: Record<string, unknown> = {};
        for (const f of config.fields) {
          if (f.defaultValue !== undefined) defaults[f.name] = f.defaultValue;
        }
        setValues(defaults);
        setState({ status: "ready", config });
      })
      .catch((err: Error) => {
        setState({ status: "error", message: err.message });
      });
  }, [workflowId, t]);

  const handleSubmit = useCallback(async () => {
    if (state.status !== "ready") return;

    const { config } = state;
    setState({ status: "submitting", config });

    try {
      const apiBaseUrl = getApiBaseUrl();
      const url = `${apiBaseUrl}/form-triggers/${workflowId}`;
      const res = await submitSchemaForm(url, config.fields, values);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setState({
          status: "error",
          message:
            (data as { error?: string }).error || t("pages.form.submitFailed"),
        });
        return;
      }

      const response = (data as { response?: FormResponse }).response;
      setState({ status: "success", mode: config.mode, response });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : t("pages.form.submitFailed"),
      });
    }
  }, [state, workflowId, values, t]);

  const isSubmitting = state.status === "submitting";
  const config =
    state.status === "ready" || state.status === "submitting"
      ? state.config
      : null;
  const isValid = config ? isFormValid(config.fields, values) : false;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-lg">
        {state.status === "loading" && (
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        )}

        {state.status === "error" && (
          <CardHeader>
            <CardTitle>{t("pages.form.errorTitle")}</CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
        )}

        {state.status === "success" &&
          (state.response && state.response.fields.length > 0 ? (
            <CardContent className="pt-6">
              <dl className="divide-y divide-border rounded-md border">
                {state.response.fields.map((field) => (
                  <div
                    key={field.name}
                    className="flex justify-between gap-4 px-3 py-2"
                  >
                    <dt className="text-sm text-muted-foreground">
                      {field.label || field.name}
                    </dt>
                    <dd className="text-sm font-medium text-right break-words">
                      {formatResponseValue(state.response?.record[field.name], t)}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          ) : (
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <CardTitle>{t("pages.form.successTitle")}</CardTitle>
              <CardDescription>
                {state.mode === "webhook"
                  ? t("pages.form.successWebhook")
                  : t("pages.form.successRequest")}
              </CardDescription>
            </CardHeader>
          ))}

        {config && (
          <>
            <CardHeader>
              <CardTitle>{config.title}</CardTitle>
              {config.description && (
                <CardDescription>{config.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {config.fields.map((field) => (
                <SchemaFieldInput
                  key={field.name}
                  field={field}
                  value={values[field.name]}
                  onChange={(value) =>
                    setValues((prev) => ({ ...prev, [field.name]: value }))
                  }
                  disabled={isSubmitting}
                />
              ))}
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                disabled={isSubmitting || !isValid}
                onClick={handleSubmit}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("pages.form.submit")}
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
