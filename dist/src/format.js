import { TokenCodec } from "./tokenizer.js";
/** Compact decoding contract intended for an LLM system/developer message. */
export const DECODER_CONTRACT = "D lines: symbol+JSON string. Expand symbols in B before reasoning; preserve all else exactly.";
export function renderDictionaryEntry(entry) {
    return `${entry.alias}${JSON.stringify(entry.value)}`;
}
export function renderDictionary(document) {
    return document.dictionary.map(renderDictionaryEntry).join("\n");
}
/**
 * LTCF/2 prompt representation:
 *   D
 *   <one-symbol><JSON-string>
 *   B
 *   <body until end of message>
 */
export function renderPayload(document) {
    const dictionary = renderDictionary(document);
    return dictionary.length === 0
        ? `D\nB\n${document.body}`
        : `D\n${dictionary}\nB\n${document.body}`;
}
export function renderPromptForLLM(document) {
    return `${DECODER_CONTRACT}\n${renderPayload(document)}`;
}
/** Returns the original text whenever the wrapper would cost more tokens. */
export function renderBestPrompt(document, original) {
    const codec = new TokenCodec(document.encoding);
    const compressed = renderPromptForLLM(document);
    return document.dictionary.length > 0 && codec.count(compressed) < codec.count(original)
        ? compressed
        : original;
}
export function serializeDocument(document) {
    return `${JSON.stringify(document, null, 2)}\n`;
}
export function parseDocument(serialized) {
    const parsed = JSON.parse(serialized);
    if (!isCompressedDocument(parsed)) {
        throw new Error("Invalid LTCF/2 document.");
    }
    return parsed;
}
function isCompressedDocument(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const record = value;
    return (record.format === "LTCF/2" &&
        record.encoding === "o200k_base" &&
        typeof record.checksumSha256 === "string" &&
        typeof record.originalBytes === "number" &&
        typeof record.originalTokens === "number" &&
        /^[a-f0-9]{64}$/.test(record.checksumSha256) &&
        Array.isArray(record.dictionary) &&
        record.dictionary.every(isDictionaryEntry) &&
        typeof record.body === "string");
}
function isDictionaryEntry(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const record = value;
    return (typeof record.alias === "string" &&
        record.alias.length > 0 &&
        typeof record.value === "string" &&
        typeof record.occurrences === "number" &&
        Number.isSafeInteger(record.occurrences) &&
        record.occurrences >= 2 &&
        typeof record.valueTokens === "number" &&
        Number.isSafeInteger(record.valueTokens) &&
        record.valueTokens > 0 &&
        typeof record.aliasTokens === "number" &&
        Number.isSafeInteger(record.aliasTokens) &&
        record.aliasTokens > 0 &&
        typeof record.estimatedNetSaving === "number" &&
        Number.isFinite(record.estimatedNetSaving) &&
        typeof record.exactMarginalSaving === "number" &&
        Number.isSafeInteger(record.exactMarginalSaving) &&
        record.exactMarginalSaving > 0);
}
//# sourceMappingURL=format.js.map