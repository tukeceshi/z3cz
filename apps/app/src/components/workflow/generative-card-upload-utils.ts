import type { WorkflowParameter } from "./workflow-types";

export function readGenerativePrompt(
  inputs: readonly WorkflowParameter[]
): string {
  const value = inputs.find((input) => input.id === "prompt")?.value;
  return typeof value === "string" ? value : "";
}

export function withGenerativePromptCleared(
  inputs: readonly WorkflowParameter[]
): WorkflowParameter[] {
  return inputs.map((input) =>
    input.id === "prompt" ? { ...input, value: "" } : input
  );
}

export function canGenerativeCardDoubleClickUpload(params: {
  readonly hasMedia: boolean;
  readonly isGenerating: boolean;
  readonly disabled?: boolean;
  readonly uploading?: boolean;
}): boolean {
  if (params.disabled || params.uploading) {
    return false;
  }
  if (params.hasMedia || params.isGenerating) {
    return false;
  }
  return true;
}

export function hasGenerativePrompt(prompt: string): boolean {
  return prompt.trim().length > 0;
}

export function generativePromptWithinModelLimit(
  prompt: string,
  maxChars: number
): boolean {
  return prompt.trim().length <= maxChars;
}
