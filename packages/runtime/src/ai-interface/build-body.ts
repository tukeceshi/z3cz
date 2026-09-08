import type {
  AiInterfaceBodySlot,
  AiInterfaceFieldSpec,
  ReferenceImageInline,
} from "@dafthunk/types";
import { buildOpenAiMultimodalUserContent } from "@dafthunk/types";

function readToolCalls(
  value: unknown
): Array<{
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}> {
  if (!Array.isArray(value)) {
    return [];
  }
  const calls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const name =
      typeof record.name === "string"
        ? record.name
        : typeof (record.function as { name?: unknown } | undefined)?.name ===
            "string"
          ? (record.function as { name: string }).name
          : "";
    if (!name) {
      continue;
    }
    const args =
      typeof record.arguments === "string"
        ? record.arguments
        : typeof (record.function as { arguments?: unknown } | undefined)
              ?.arguments === "string"
          ? (record.function as { arguments: string }).arguments
          : "";
    calls.push({
      id: typeof record.id === "string" ? record.id : `call-${calls.length}`,
      type: "function",
      function: { name, arguments: args },
    });
  }
  return calls;
}

function readChatMessages(
  value: unknown
): Array<Record<string, unknown>> | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const messages: Array<Record<string, unknown>> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const role = record.role;
    const content = typeof record.content === "string" ? record.content : "";
    if (role === "tool") {
      const toolCallId =
        typeof record.toolCallId === "string"
          ? record.toolCallId
          : typeof record.tool_call_id === "string"
            ? record.tool_call_id
            : "";
      if (!toolCallId) {
        continue;
      }
      messages.push({
        role: "tool",
        tool_call_id: toolCallId,
        content,
      });
      continue;
    }
    if (role !== "user" && role !== "assistant" && role !== "system") {
      continue;
    }
    const toolCalls = readToolCalls(record.toolCalls ?? record.tool_calls);
    if (role === "assistant" && toolCalls.length > 0) {
      messages.push({
        role,
        content: content || null,
        tool_calls: toolCalls,
      });
      continue;
    }
    if (content.trim().length === 0) {
      continue;
    }
    messages.push({ role, content });
  }
  return messages.length > 0 ? messages : null;
}

function readStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value.filter((entry): entry is string => typeof entry === "string");
  return items.length > 0 ? items : undefined;
}

function readReferenceImageInline(
  value: unknown
): readonly ReferenceImageInline[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value.filter((entry): entry is ReferenceImageInline => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const record = entry as Record<string, unknown>;
    return (
      typeof record.mimeType === "string" && typeof record.data === "string"
    );
  });
  return items.length > 0 ? items : undefined;
}

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
      const history = readChatMessages(inputs.messages);
      if (history) {
        const messages: Array<{ role: string; content: unknown }> = [];
        if (slot.systemField) {
          const system = inputs[slot.systemField];
          if (typeof system === "string" && system.trim().length > 0) {
            messages.push({ role: "system", content: system });
          }
        }
        messages.push(...history);
        body[slot.to] = messages;
        continue;
      }

      const promptField = slot.promptField ?? "prompt";
      const prompt = inputs[promptField];
      if (typeof prompt !== "string" || prompt.trim().length === 0) {
        return { error: `${promptField} is required` };
      }

      const content = buildOpenAiMultimodalUserContent({
        prompt,
        referenceImageUrls: readStringArray(inputs.referenceImageUrls),
        referenceImageInline: readReferenceImageInline(
          inputs.referenceImageInline
        ),
        referenceVideoUrls: readStringArray(inputs.referenceVideoUrls),
      });

      const messages: Array<{ role: string; content: unknown }> = [];
      if (slot.systemField) {
        const system = inputs[slot.systemField];
        if (typeof system === "string" && system.trim().length > 0) {
          messages.push({ role: "system", content: system });
        }
      }
      messages.push({ role: "user", content });
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
