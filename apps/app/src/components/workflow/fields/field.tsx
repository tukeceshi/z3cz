import { AnyField } from "./any-field";
import { AudioField } from "./audio-field";
import { GenericField } from "./generic-field";
import { ImageField } from "./image-field";
import { JsonField } from "./json-field";
import { TextField } from "./text-field";
import type { FieldProps, ObjectReference } from "./types";
import { VideoField } from "./video-field";

export interface FieldRouterProps extends FieldProps {
  createObjectUrl?: (objectReference: ObjectReference) => string;
}

export function Field(props: FieldRouterProps) {
  const { parameter, createObjectUrl } = props;

  switch (parameter.type) {
    case "string":
      return <TextField {...props} />;
    case "json":
      return <JsonField {...props} />;
    case "image":
      return <ImageField {...props} createObjectUrl={createObjectUrl} />;
    case "audio":
      return <AudioField {...props} createObjectUrl={createObjectUrl} />;
    case "video":
      return <VideoField {...props} createObjectUrl={createObjectUrl} />;
    case "any":
      return <AnyField {...props} createObjectUrl={createObjectUrl} />;
    default:
      return <GenericField {...props} />;
  }
}
