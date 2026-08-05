import { GenerativeConnectionSides } from "./generative-edge-connection-side";

export interface AiTextConnectionSidesProps {
  readonly disabled?: boolean;
}

/** AI text node left/right connection UI. */
export function AiTextConnectionSides({
  disabled = false,
}: AiTextConnectionSidesProps) {
  return <GenerativeConnectionSides modality="text" disabled={disabled} />;
}
