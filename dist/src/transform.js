import { createHash } from "node:crypto";
import { optimizeCompression } from "./optimizer.js";
import { decompress } from "./compressor.js";
import { TokenCodec } from "./tokenizer.js";
import { applySharedDictionary, expandSharedDictionary, } from "./shared.js";
const STANDALONE_PREFIX = "LTCF standalone. D lines are alias+JSON-string. Expand D aliases in B before reasoning; preserve all else exactly.\n";
const SESSION_PREFIX = "LTCF ";
export function transformPrompt(original, options = {}) {
    const profile = options.profile ?? "balanced";
    const minimumSavingTokens = options.minimumSavingTokens ?? 1;
    const shared = options.sharedDictionary;
    const codec = new TokenCodec(shared?.encoding ?? "o200k_base");
    const originalTokens = codec.count(original);
    const checksumSha256 = createHash("sha256").update(original, "utf8").digest("hex");
    if (options.enabled === false) {
        return originalResult(original, originalTokens, checksumSha256);
    }
    if (shared && options.sessionMode) {
        const base = applySharedDictionary(original, shared);
        const optimized = optimizeCompression(base.body, profile, {
            encoding: shared.encoding,
            maxEntries: Math.max(1, 64 - shared.entries.length),
            reservedAliases: shared.entries.map((entry) => entry.alias),
        });
        const dynamic = optimized.document;
        const deltaLines = dynamic.dictionary.map((entry) => `${entry.alias}${JSON.stringify(entry.value)}`).join("\n");
        const prompt = [
            `${SESSION_PREFIX}${shared.id}@${shared.version}`,
            "D",
            deltaLines,
            "B",
            dynamic.body,
        ].filter((line, index, array) => !(line === "" && array[index - 1] === "D")).join("\n");
        const promptTokens = codec.count(prompt);
        const savedTokens = originalTokens - promptTokens;
        if (savedTokens >= minimumSavingTokens) {
            return result({
                original,
                prompt,
                compressed: true,
                mode: "shared-session",
                originalTokens,
                promptTokens,
                checksumSha256,
                sharedDictionaryRef: `${shared.id}@${shared.version}`,
                sharedAliasesUsed: base.used.length,
                deltaAliasesUsed: dynamic.dictionary.length,
                decodeLocal: () => {
                    const baseRestored = decompress(dynamic);
                    const restored = expandSharedDictionary(baseRestored, shared);
                    assertChecksum(restored, checksumSha256);
                    return restored;
                },
            });
        }
    }
    const optimized = optimizeCompression(original, profile);
    const document = optimized.document;
    const compressedPrompt = `${STANDALONE_PREFIX}${renderBarePayload(document)}`;
    const promptTokens = codec.count(compressedPrompt);
    const savedTokens = originalTokens - promptTokens;
    if (document.dictionary.length > 0 && savedTokens >= minimumSavingTokens) {
        return result({
            original,
            prompt: compressedPrompt,
            compressed: true,
            mode: "standalone",
            originalTokens,
            promptTokens,
            checksumSha256,
            sharedAliasesUsed: 0,
            deltaAliasesUsed: document.dictionary.length,
            decodeLocal: () => {
                const restored = decompress(document);
                assertChecksum(restored, checksumSha256);
                return restored;
            },
        });
    }
    return originalResult(original, originalTokens, checksumSha256);
}
function originalResult(original, originalTokens, checksumSha256) {
    return result({
        original,
        prompt: original,
        compressed: false,
        mode: "original",
        originalTokens,
        promptTokens: originalTokens,
        checksumSha256,
        sharedAliasesUsed: 0,
        deltaAliasesUsed: 0,
        decodeLocal: () => original,
    });
}
function renderBarePayload(document) {
    const dictionary = document.dictionary.map((entry) => `${entry.alias}${JSON.stringify(entry.value)}`).join("\n");
    return dictionary ? `D\n${dictionary}\nB\n${document.body}` : `D\nB\n${document.body}`;
}
function result(input) {
    const savedTokens = input.savedTokens ?? input.originalTokens - input.promptTokens;
    return {
        ...input,
        savedTokens,
        reductionPercent: input.originalTokens === 0 ? 0 : (savedTokens / input.originalTokens) * 100,
    };
}
function assertChecksum(text, expected) {
    const actual = createHash("sha256").update(text, "utf8").digest("hex");
    if (actual !== expected)
        throw new Error(`Prompt checksum mismatch: expected ${expected}, got ${actual}`);
}
export function renderModelRequestOnly(result) {
    return result.prompt;
}
//# sourceMappingURL=transform.js.map