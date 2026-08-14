import type { CompressionOptions, OptimizationProfile, OptimizationResult } from "./types.js";
/**
 * Searches multiple maximum phrase lengths and picks the smallest complete LLM
 * prompt. Dictionary cardinality is not swept: compress() already stops exactly
 * when the next rule has no positive marginal token saving.
 */
export declare function optimizeCompression(original: string, profile?: OptimizationProfile, overrides?: CompressionOptions): OptimizationResult;
