import type { TransformPollMapping } from "@dafthunk/types";
import {
  createDefaultTransformPollMapping,
  formatPollValuesForInput,
  parsePollValuesFromInput,
} from "@dafthunk/types";

import { useTranslation } from "@/components/locale-provider";
import { CredentialPlainInput } from "@/components/credential-secret-input";
import { Label } from "@/components/ui/label";

interface PollMappingFieldsProps {
  readonly value: TransformPollMapping;
  readonly onChange: (value: TransformPollMapping) => void;
}

export function PollMappingFields(props: PollMappingFieldsProps) {
  const { t } = useTranslation();
  const defaults = createDefaultTransformPollMapping();

  return (
    <div className="space-y-3 rounded-lg border bg-background p-4">
      <div>
        <h3 className="font-medium">
          {t("adminApiForwarding.mapping.pollTaskParams")}
        </h3>
        <p className="text-muted-foreground text-sm">
          {t("adminApiForwarding.mapping.pollTaskParamsHelp")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="poll_status_key">
            {t("adminApiForwarding.mapping.pollStatusKey")}
          </Label>
          <CredentialPlainInput
            id="poll_status_key"
            name="poll_status_key"
            value={props.value.statusKey}
            onChange={(event) =>
              props.onChange({
                ...props.value,
                statusKey: event.target.value,
              })
            }
            placeholder={defaults.statusKey}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="poll_output_key">
            {t("adminApiForwarding.mapping.pollOutputKey")}
          </Label>
          <CredentialPlainInput
            id="poll_output_key"
            name="poll_output_key"
            value={props.value.outputKey}
            onChange={(event) =>
              props.onChange({
                ...props.value,
                outputKey: event.target.value,
              })
            }
            placeholder={defaults.outputKey}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="poll_success_values">
            {t("adminApiForwarding.mapping.pollSuccessValues")}
          </Label>
          <CredentialPlainInput
            id="poll_success_values"
            name="poll_success_values"
            value={formatPollValuesForInput(props.value.successValues)}
            onChange={(event) =>
              props.onChange({
                ...props.value,
                successValues: parsePollValuesFromInput(event.target.value),
              })
            }
            placeholder={formatPollValuesForInput(defaults.successValues)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="poll_failed_values">
            {t("adminApiForwarding.mapping.pollFailedValues")}
          </Label>
          <CredentialPlainInput
            id="poll_failed_values"
            name="poll_failed_values"
            value={formatPollValuesForInput(props.value.failedValues)}
            onChange={(event) =>
              props.onChange({
                ...props.value,
                failedValues: parsePollValuesFromInput(event.target.value),
              })
            }
            placeholder={formatPollValuesForInput(defaults.failedValues)}
          />
        </div>
      </div>
    </div>
  );
}

export { createDefaultTransformPollMapping as defaultPollMapping };
