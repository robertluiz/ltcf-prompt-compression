import type { CompressedDocument, CompressionMetrics, CompressionOptions } from "./types.js";
export declare const DEFAULT_COMPRESSION_OPTIONS: Required<CompressionOptions>;
/**
 * Builds an adaptive dictionary using a greedy Minimum Description Length
 * objective. Each rule is accepted only when the exact rendered payload becomes
 * smaller after including both the dictionary line and every replacement.
 */
export declare function compress(original: string, options?: CompressionOptions): CompressedDocument;
export declare function decompress(document: CompressedDocument): string;
export declare function metrics(document: CompressedDocument): CompressionMetrics;
