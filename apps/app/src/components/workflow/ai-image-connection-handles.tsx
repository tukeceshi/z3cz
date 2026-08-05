import { GenerativeConnectionSides } from "./generative-edge-connection-side";

export interface AiImageConnectionSidesProps {
  readonly disabled?: boolean;
}

export function AiImageConnectionSides({
  disabled = false,
}: AiImageConnectionSidesProps) {
  return <GenerativeConnectionSides modality="image" disabled={disabled} />;
}
