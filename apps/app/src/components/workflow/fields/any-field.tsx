import { isObjectReference } from "@/services/object-service";

import { GenericField } from "./generic-field";
import { ImageField } from "./image-field";
import { JsonField } from "./json-field";
import { TextField } from "./text-field";
import type { FieldProps, ObjectReference } from "./types";

export function AnyField({
  className,
  connected,
  createObjectUrl,
  parameter,
  value,
}: Pick<FieldProps, "className" | "connected" | "parameter" | "value"> & {
  createObjectUrl?: (objectReference: ObjectReference) => string;
}) {
  const noop = () => {};
  const hasValue = value !== undefined && value !== null;

  if (hasValue && isObjectReference(value)) {
    return (
      <ImageField
        className={className}
        connected={connected}
        createObjectUrl={createObjectUrl}
        disabled
        onChange={noop}
        onClear={noop}
        parameter={parameter}
        value={value}
      />
    );
  }

  if (
    hasValue &&
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isObjectReference)
  ) {
    return (
      <ImageField
        className={className}
        connected={connected}
        createObjectUrl={createObjectUrl}
        disabled
        onChange={noop}
        onClear={noop}
        parameter={{ ...parameter, repeated: true }}
        value={value}
      />
    );
  }

  if (hasValue && (Array.isArray(value) || typeof value === "object")) {
    return (
      <JsonField
        className={className}
        connected={connected}
        disabled
        onChange={noop}
        onClear={noop}
        parameter={parameter}
        value={value}
      />
    );
  }

  if (typeof value === "boolean" || typeof value === "number") {
    return (
      <GenericField
        className={className}
        connected={connected}
        disabled
        onChange={noop}
        onClear={noop}
        parameter={parameter}
        value={value}
      />
    );
  }

  return (
    <TextField
      className={className}
      connected={connected}
      disabled
      onChange={noop}
      onClear={noop}
      parameter={parameter}
      value={value}
    />
  );
}
