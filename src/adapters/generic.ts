import { transformPrompt, type PromptTransformResult, type TransformOptions } from "../transform.js";

export interface GenericHarnessInvocation<T> {
  transform: PromptTransformResult;
  response: T;
}

/**
 * Smallest possible harness integration contract.
 *
 * The callback receives exactly one prompt: the selected model input. When
 * compression wins, that value is the compressed prompt; the original is never
 * passed to the harness callback.
 */
export async function invokeWithCompression<T>(
  originalPrompt: string,
  send: (modelPrompt: string, transform: PromptTransformResult) => T | Promise<T>,
  options: TransformOptions = {},
): Promise<GenericHarnessInvocation<T>> {
  const transform = transformPrompt(originalPrompt, options);
  const response = await send(transform.prompt, transform);
  return { transform, response };
}
