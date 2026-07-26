import type {
  AiInterfaceBodySlot,
  AiInterfaceFieldSpec,
} from "@dafthunk/types";

export function buildBodyFromSlots(params: {
  slots: readonly AiInterfaceBodySlot[];
  inputs: Readonly<Record<string, unknown>>;
  model: string;
  fields: readonly AiInterfaceFieldSpec[];
}): Record<string, unknown> | { error: string } {
  const { slots, inputs, model, fields } = params;
  const body: Record<string, unknown> = {};
  const fieldByName = new Map(fields.map((field) => [field.name, field]));

  for (const slot of slots) {
    if (slot.kind === "const") {
      body[slot.to] = slot.value;
      continue;
    }

    if (slot.kind === "model") {
      body[slot.to] = model;
      continue;
    }

    if (slot.kind === "openai-messages") {
      const promptField = slot.promptField ?? "prompt";
      const prompt = inputs[promptField];
      if (typeof prompt !== "string" || prompt.trim().length === 0) {
        return { error: `${promptField} is required` };
      }

      const messages: Array<{ role: string; content: string }> = [];
      if (slot.systemField) {
        const system = inputs[slot.systemField];
        if (typeof system === "string" && system.trim().length > 0) {
          messages.push({ role: "system", content: system });
        }
      }
      messages.push({ role: "user", content: prompt });
      body[slot.to] = messages;
      continue;
    }

    if (slot.kind === "anthropic-messages") {
      const promptField = slot.promptField ?? "prompt";
      const prompt = inputs[promptField];
      if (typeof prompt !== "string" || prompt.trim().length === 0) {
        return { error: `${promptField} is required` };
      }
      body[slot.to] = [{ role: "user", content: prompt }];
      continue;
    }

    const fieldName = slot.from ?? slot.to;
    const field = fieldByName.get(fieldName);
    const raw = inputs[fieldName];
    const value =
      raw === undefined || raw === null || raw === ""
        ? field?.default
        : raw;

    if (
      (value === undefined || value === null || value === "") &&
      field?.required
    ) {
      return { error: `${fieldName} is required` };
    }

    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (field?.type === "number") {
      const numeric = Number(value);
      if (Number.isNaN(numeric)) {
        return { error: `${fieldName} must be a number` };
      }
      body[slot.to] = numeric;
      continue;
    }

    if (field?.type === "boolean") {
      body[slot.to] = Boolean(value);
      continue;
    }

    body[slot.to] = value;
  }

  return body;
}
