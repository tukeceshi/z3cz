import { useTranslation } from "@/components/locale-provider";
import {
  buildSingleModelEndpointUrlPreview,
  type SingleModelPresetCategory,
} from "@dafthunk/types";

interface SingleModelEndpointUrlPreviewProps {
  readonly baseUrl: string;
  readonly category: SingleModelPresetCategory | string;
  readonly useFullSubmitUrl?: boolean;
}

export function SingleModelEndpointUrlPreview(
  props: SingleModelEndpointUrlPreviewProps
) {
  const { t } = useTranslation();
  const preview = buildSingleModelEndpointUrlPreview({
    baseUrl: props.baseUrl,
    category: props.category,
    useFullSubmitUrl: props.useFullSubmitUrl,
  });

  if (!preview.fullUrlPreview) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("pages.aiInterfaces.singleModel.endpointPreviewEmpty")}
      </p>
    );
  }

  return (
    <p className="text-xs text-muted-foreground">
      {t("pages.aiInterfaces.singleModel.endpointPreviewFullUrl")}：
      <span className="text-foreground break-all font-mono">
        {preview.fullUrlPreview}
      </span>
    </p>
  );
}

interface SingleModelUseFullSubmitUrlFieldProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly idPrefix: string;
}

export function SingleModelUseFullSubmitUrlField(
  props: SingleModelUseFullSubmitUrlFieldProps
) {
  const { t } = useTranslation();

  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        id={`${props.idPrefix}-use-full-submit-url`}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded border border-input accent-primary"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
      <span className="leading-snug">
        {t("pages.aiInterfaces.singleModel.noSuffixConcatenation")}
      </span>
    </label>
  );
}

interface SingleModelVideoEndpointUrlFieldsProps {
  readonly baseUrl: string;
  readonly category: SingleModelPresetCategory | string;
  readonly useFullSubmitUrl: boolean;
  readonly onUseFullSubmitUrlChange: (checked: boolean) => void;
  readonly idPrefix: string;
}

export function SingleModelVideoEndpointUrlFields({
  baseUrl,
  category,
  useFullSubmitUrl,
  onUseFullSubmitUrlChange,
  idPrefix,
}: SingleModelVideoEndpointUrlFieldsProps) {
  return (
    <div className="space-y-2">
      <SingleModelEndpointUrlPreview
        baseUrl={baseUrl}
        category={category}
        useFullSubmitUrl={useFullSubmitUrl}
      />
      <SingleModelUseFullSubmitUrlField
        idPrefix={idPrefix}
        checked={useFullSubmitUrl}
        onChange={onUseFullSubmitUrlChange}
      />
    </div>
  );
}
