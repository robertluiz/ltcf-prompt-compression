import { compress, metrics } from "./compressor.js";
import { TokenCodec } from "./tokenizer.js";
const PROFILES = {
    balanced: {
        maxNgramCandidates: [8, 16, 32],
        maxEntries: 64,
        candidateLimit: 1_000,
        exactCandidatesPerRound: 64,
    },
    aggressive: {
        maxNgramCandidates: [16, 32, 48],
        maxEntries: 64,
        candidateLimit: 1_000,
        exactCandidatesPerRound: 64,
    },
};
/**
 * Searches multiple maximum phrase lengths and picks the smallest complete LLM
 * prompt. Dictionary cardinality is not swept: compress() already stops exactly
 * when the next rule has no positive marginal token saving.
 */
export function optimizeCompression(original, profile = "balanced", overrides = {}) {
    const selectedProfile = PROFILES[profile];
    const codec = new TokenCodec(overrides.encoding ?? "o200k_base");
    const sourceTokens = codec.count(original);
    const candidateLengths = [...new Set(selectedProfile.maxNgramCandidates
            .map((value) => Math.min(value, Math.max(2, sourceTokens - 1)))
            .filter((value) => value >= 2))];
    let bestDocument;
    let bestMetrics;
    let bestMaxNgramTokens = candidateLengths[0] ?? 2;
    const trials = [];
    for (const maxNgramTokens of candidateLengths) {
        const started = Date.now();
        const document = compress(original, {
            maxEntries: selectedProfile.maxEntries,
            candidateLimit: selectedProfile.candidateLimit,
            exactCandidatesPerRound: selectedProfile.exactCandidatesPerRound,
            minRuleTokenSaving: 1,
            ...overrides,
            maxNgramTokens,
        });
        const value = metrics(document);
        const elapsedMilliseconds = Date.now() - started;
        trials.push({
            maxNgramTokens,
            dictionaryEntries: value.dictionaryEntries,
            bodyTokens: value.bodyTokens,
            dictionaryTokens: value.dictionaryTokens,
            payloadTokens: value.payloadTokens,
            promptTokens: value.promptWithDecoderTokens,
            reductionPercent: value.tokenReductionWithDecoderPercent,
            elapsedMilliseconds,
        });
        if (!bestMetrics ||
            value.promptWithDecoderTokens < bestMetrics.promptWithDecoderTokens ||
            (value.promptWithDecoderTokens === bestMetrics.promptWithDecoderTokens &&
                value.dictionaryEntries < bestMetrics.dictionaryEntries)) {
            bestDocument = document;
            bestMetrics = value;
            bestMaxNgramTokens = maxNgramTokens;
        }
    }
    if (!bestDocument || !bestMetrics) {
        throw new Error("Optimizer produced no candidate configuration.");
    }
    return {
        profile,
        selectedMaxNgramTokens: bestMaxNgramTokens,
        document: bestDocument,
        metrics: bestMetrics,
        trials,
    };
}
//# sourceMappingURL=optimizer.js.map