import type { SubAccountPermissions } from "@dafthunk/types";
import { DEFAULT_SUB_ACCOUNT_PERMISSIONS } from "@dafthunk/types";

import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const PERMISSION_LABELS: Record<
  "executions" | "modelCalls" | "aiInterfaces" | "apiKeys",
  TranslationKey
> = {
  executions: "pages.members.permissions.executions",
  modelCalls: "pages.members.permissions.modelCalls",
  aiInterfaces: "pages.members.permissions.aiInterfaces",
  apiKeys: "pages.members.permissions.apiKeys",
};

interface SubAccountPermissionsFormProps {
  value: SubAccountPermissions;
  onChange: (next: SubAccountPermissions) => void;
  disabled?: boolean;
}

export function SubAccountPermissionsForm({
  value,
  onChange,
  disabled = false,
}: SubAccountPermissionsFormProps) {
  const { t } = useTranslation();

  const update = (patch: Partial<SubAccountPermissions>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="perm-workflows">{t("pages.members.permissions.workflows")}</Label>
        <Select
          value={value.workflows}
          onValueChange={(workflows: "view" | "edit") => update({ workflows })}
          disabled={disabled}
        >
          <SelectTrigger id="perm-workflows" className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="view">{t("pages.members.permissions.viewOnly")}</SelectItem>
            <SelectItem value="edit">{t("pages.members.permissions.edit")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(
        Object.entries(PERMISSION_LABELS) as Array<
          ["executions" | "modelCalls" | "aiInterfaces" | "apiKeys", TranslationKey]
        >
      ).map(([key, labelKey]) => (
        <div key={key} className="flex items-center justify-between gap-4">
          <Label htmlFor={`perm-${key}`}>{t(labelKey)}</Label>
          <Switch
            id={`perm-${key}`}
            checked={value[key]}
            onCheckedChange={(next) => update({ [key]: next })}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}

export function createDefaultInvitePermissions(): SubAccountPermissions {
  return { ...DEFAULT_SUB_ACCOUNT_PERMISSIONS };
}
