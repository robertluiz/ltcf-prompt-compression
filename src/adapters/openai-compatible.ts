import { transformPrompt, type TransformOptions, type PromptTransformResult } from "../transform.js";

export interface OpenAICompatibleTransform {
  body: Record<string, unknown>;
  transforms: PromptTransformResult[];
}

/**
 * Rewrites user text in common OpenAI-compatible request shapes. This adapter
 * is intentionally pure: callers decide where/how to send the resulting JSON.
 */
export function transformOpenAICompatibleRequest(
  body: Record<string, unknown>,
  options: TransformOptions = {},
): OpenAICompatibleTransform {
  const clone = structuredClone(body);
  const transforms: PromptTransformResult[] = [];

  if (typeof clone.input === "string") {
    const transformed = transformPrompt(clone.input, options);
    clone.input = transformed.prompt;
    transforms.push(transformed);
  } else if (Array.isArray(clone.input)) {
    clone.input = transformItems(clone.input, options, transforms);
  }

  if (Array.isArray(clone.messages)) {
    clone.messages = clone.messages.map((message) => {
      if (!message || typeof message !== "object") return message;
      const record = { ...(message as Record<string, unknown>) };
      if (record.role !== "user") return record;
      if (typeof record.content === "string") {
        const transformed = transformPrompt(record.content, options);
        record.content = transformed.prompt;
        transforms.push(transformed);
      }
      return record;
    });
  }

  return { body: clone, transforms };
}

function transformItems(
  items: unknown[],
  options: TransformOptions,
  transforms: PromptTransformResult[],
): unknown[] {
  return items.map((item) => {
    if (!item || typeof item !== "object") return item;
    const record = { ...(item as Record<string, unknown>) };
    if (record.role !== "user" || !Array.isArray(record.content)) return record;
    record.content = record.content.map((part) => {
      if (!part || typeof part !== "object") return part;
      const content = { ...(part as Record<string, unknown>) };
      if ((content.type === "input_text" || content.type === "text") && typeof content.text === "string") {
        const transformed = transformPrompt(content.text, options);
        content.text = transformed.prompt;
        transforms.push(transformed);
      }
      return content;
    });
    return record;
  });
}
