import { useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VolcanoCredentialFieldsProps {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly onAccessKeyIdChange: (value: string) => void;
  readonly onSecretAccessKeyChange: (value: string) => void;
  readonly idPrefix?: string;
}

function useAntiAutofillField() {
  const [readOnly, setReadOnly] = useState(true);
  return {
    readOnly,
    onFocus: () => setReadOnly(false),
    onBlur: () => setReadOnly(true),
  };
}

export function VolcanoCredentialFields({
  accessKeyId,
  secretAccessKey,
  onAccessKeyIdChange,
  onSecretAccessKeyChange,
  idPrefix = "volcano",
}: VolcanoCredentialFieldsProps) {
  const { t } = useTranslation();
  const accessKeyAntiAutofill = useAntiAutofillField();
  const secretAntiAutofill = useAntiAutofillField();

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-iam-access-key-id`}>
          {t("pages.aiInterfaces.volcano.accessKeyId")}
        </Label>
        <Input
          id={`${idPrefix}-iam-access-key-id`}
          name="volcengine_iam_access_key_id"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          readOnly={accessKeyAntiAutofill.readOnly}
          onFocus={accessKeyAntiAutofill.onFocus}
          onBlur={accessKeyAntiAutofill.onBlur}
          value={accessKeyId}
          onChange={(event) => onAccessKeyIdChange(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-iam-secret-access-key`}>
          {t("pages.aiInterfaces.volcano.secretAccessKey")}
        </Label>
        <Input
          id={`${idPrefix}-iam-secret-access-key`}
          name="volcengine_iam_secret_access_key"
          type="password"
          autoComplete="new-password"
          data-1p-ignore
          data-lpignore="true"
          readOnly={secretAntiAutofill.readOnly}
          onFocus={secretAntiAutofill.onFocus}
          onBlur={secretAntiAutofill.onBlur}
          value={secretAccessKey}
          onChange={(event) => onSecretAccessKeyChange(event.target.value)}
        />
      </div>
    </>
  );
}
