import { GenerativeConnectionSides } from "./generative-edge-connection-side";

export interface AiVideoConnectionSidesProps {
  readonly disabled?: boolean;
}

export function AiVideoConnectionSides({
  disabled = false,
}: AiVideoConnectionSidesProps) {
  return <GenerativeConnectionSides modality="video" disabled={disabled} />;
}
