import { type SharedDictionary } from "./shared.js";
import type { OptimizationProfile } from "./types.js";
export interface TransformOptions {
    profile?: OptimizationProfile;
    sharedDictionary?: SharedDictionary;
    sessionMode?: boolean;
    minimumSavingTokens?: number;
    enabled?: boolean;
}
export interface PromptTransformResult {
    original: string;
    prompt: string;
    compressed: boolean;
    mode: "original" | "standalone" | "shared-session";
    originalTokens: number;
    promptTokens: number;
    savedTokens: number;
    reductionPercent: number;
    checksumSha256: string;
    sharedDictionaryRef?: string;
    sharedAliasesUsed: number;
    deltaAliasesUsed: number;
    decodeLocal(): string;
}
export declare function transformPrompt(original: string, options?: TransformOptions): PromptTransformResult;
export declare function renderModelRequestOnly(result: PromptTransformResult): string;
