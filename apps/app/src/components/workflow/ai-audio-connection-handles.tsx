import { GenerativeConnectionSides } from "./generative-edge-connection-side";

export interface AiAudioConnectionSidesProps {
  readonly disabled?: boolean;
  readonly promptInputDisabled?: boolean;
}

export function AiAudioConnectionSides({
  disabled = false,
  promptInputDisabled = false,
}: AiAudioConnectionSidesProps) {
  return (
    <GenerativeConnectionSides
      modality="audio"
      disabled={disabled}
      leftDisabled={promptInputDisabled}
    />
  );
}

export { snapAiAudioPromptBorderPoint } from "./ai-audio-connection-utils";
