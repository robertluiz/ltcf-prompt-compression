import type { CompressedDocument, DictionaryEntry } from "./types.js";
/** Compact decoding contract intended for an LLM system/developer message. */
export declare const DECODER_CONTRACT = "D lines: symbol+JSON string. Expand symbols in B before reasoning; preserve all else exactly.";
export declare function renderDictionaryEntry(entry: Pick<DictionaryEntry, "alias" | "value">): string;
export declare function renderDictionary(document: CompressedDocument): string;
/**
 * LTCF/2 prompt representation:
 *   D
 *   <one-symbol><JSON-string>
 *   B
 *   <body until end of message>
 */
export declare function renderPayload(document: CompressedDocument): string;
export declare function renderPromptForLLM(document: CompressedDocument): string;
/** Returns the original text whenever the wrapper would cost more tokens. */
export declare function renderBestPrompt(document: CompressedDocument, original: string): string;
export declare function serializeDocument(document: CompressedDocument): string;
export declare function parseDocument(serialized: string): CompressedDocument;
