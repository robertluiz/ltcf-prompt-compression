import { type TransformOptions, type PromptTransformResult } from "../transform.js";
export interface OpenAICompatibleTransform {
    body: Record<string, unknown>;
    transforms: PromptTransformResult[];
}
/**
 * Rewrites user text in common OpenAI-compatible request shapes. This adapter
 * is intentionally pure: callers decide where/how to send the resulting JSON.
 */
export declare function transformOpenAICompatibleRequest(body: Record<string, unknown>, options?: TransformOptions): OpenAICompatibleTransform;
