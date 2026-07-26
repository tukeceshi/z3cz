import { useTranslation } from "@/components/locale-provider";
import { CredentialPlainInput, CredentialSecretInput } from "@/components/credential-secret-input";
import { Label } from "@/components/ui/label";

interface VolcanoCredentialFieldsProps {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly onAccessKeyIdChange: (value: string) => void;
  readonly onSecretAccessKeyChange: (value: string) => void;
  readonly idPrefix?: string;
}

export function VolcanoCredentialFields({
  accessKeyId,
  secretAccessKey,
  onAccessKeyIdChange,
  onSecretAccessKeyChange,
  idPrefix = "volcano",
}: VolcanoCredentialFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-iam-access-key-id`}>
          {t("pages.aiInterfaces.volcano.accessKeyId")}
        </Label>
        <CredentialPlainInput
          id={`${idPrefix}-iam-access-key-id`}
          name="volcengine_iam_access_key_id"
          value={accessKeyId}
          onChange={(event) => onAccessKeyIdChange(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-iam-secret-access-key`}>
          {t("pages.aiInterfaces.volcano.secretAccessKey")}
        </Label>
        <CredentialSecretInput
          id={`${idPrefix}-iam-secret-access-key`}
          name="volcengine_iam_secret_access_key"
          value={secretAccessKey}
          onChange={(event) => onSecretAccessKeyChange(event.target.value)}
        />
      </div>
    </>
  );
}
