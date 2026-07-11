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

interface FormConfig {
  title: string;
  description?: string;
  fields: SchemaFormField[];
  submitted: boolean;
}

type FormState =
  | { status: "loading" }
  | { status: "ready"; config: FormConfig }
  | { status: "submitting"; config: FormConfig }
  | { status: "success" }
  | { status: "already_submitted" }
  | { status: "error"; message: string };

/**
 * Public form page for human-in-the-loop workflow input.
 * No authentication required — the signed token in the URL IS the authorization.
 */
export function FormPage() {
  const { t } = useTranslation();
  const { signedToken } = useParams<{ signedToken: string }>();
  const [state, setState] = useState<FormState>({ status: "loading" });
  const [values, setValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!signedToken) {
      setState({ status: "error", message: t("pages.form.invalidLink") });
      return;
    }

    const apiBaseUrl = getApiBaseUrl();
    fetch(`${apiBaseUrl}/forms/${signedToken}`)
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
        if (config.submitted) {
          setState({ status: "already_submitted" });
        } else {
          const defaults: Record<string, unknown> = {};
          for (const f of config.fields) {
            if (f.defaultValue !== undefined) {
              defaults[f.name] = f.defaultValue;
            }
          }
          setValues(defaults);
          setState({ status: "ready", config });
        }
      })
      .catch((err: Error) => {
        setState({ status: "error", message: err.message });
      });
  }, [signedToken, t]);

  const handleSubmit = useCallback(async () => {
    if (state.status !== "ready") return;

    setState({ status: "submitting", config: state.config });

    try {
      const apiBaseUrl = getApiBaseUrl();
      const url = `${apiBaseUrl}/forms/${signedToken}`;
      const res = await submitSchemaForm(url, state.config.fields, values);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const error =
          (data as { error?: string }).error || t("pages.form.submitFailed");
        if (res.status === 409) {
          setState({ status: "already_submitted" });
        } else {
          setState({ status: "error", message: error });
        }
        return;
      }

      setState({ status: "success" });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : t("pages.form.submitFailed"),
      });
    }
  }, [state, signedToken, values, t]);

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

        {state.status === "already_submitted" && (
          <CardHeader>
            <CardTitle>{t("pages.form.alreadySubmittedTitle")}</CardTitle>
            <CardDescription>
              {t("pages.form.alreadySubmittedDescription")}
            </CardDescription>
          </CardHeader>
        )}

        {state.status === "success" && (
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <CardTitle>{t("pages.form.successTitle")}</CardTitle>
            <CardDescription>{t("pages.form.successDescription")}</CardDescription>
          </CardHeader>
        )}

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
