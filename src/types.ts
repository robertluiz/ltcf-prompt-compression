export type EncodingName = "o200k_base";

export interface DictionaryEntry {
  alias: string;
  value: string;
  occurrences: number;
  valueTokens: number;
  aliasTokens: number;
  estimatedNetSaving: number;
  exactMarginalSaving: number;
}

export interface CompressedDocument {
  format: "LTCF/2";
  encoding: EncodingName;
  checksumSha256: string;
  originalBytes: number;
  originalTokens: number;
  dictionary: DictionaryEntry[];
  body: string;
}

export interface CompressionOptions {
  encoding?: EncodingName;
  maxEntries?: number;
  maxNgramTokens?: number;
  candidateLimit?: number;
  exactCandidatesPerRound?: number;
  minCandidateCharacters?: number;
  minRuleTokenSaving?: number;
  reservedAliases?: string[];
}

export interface CompressionMetrics {
  originalBytes: number;
  compressedStorageBytes: number;
  originalTokens: number;
  bodyTokens: number;
  dictionaryTokens: number;
  payloadTokens: number;
  decoderContractTokens: number;
  promptWithDecoderTokens: number;
  tokenSavingPayload: number;
  tokenSavingWithDecoder: number;
  tokenReductionPayloadPercent: number;
  tokenReductionWithDecoderPercent: number;
  dictionaryEntries: number;
  losslessVerified: boolean;
  useCompressedPrompt: boolean;
}

export type OptimizationProfile = "balanced" | "aggressive";

export interface OptimizationTrial {
  maxNgramTokens: number;
  dictionaryEntries: number;
  bodyTokens: number;
  dictionaryTokens: number;
  payloadTokens: number;
  promptTokens: number;
  reductionPercent: number;
  elapsedMilliseconds: number;
}

export interface OptimizationResult {
  profile: OptimizationProfile;
  selectedMaxNgramTokens: number;
  document: CompressedDocument;
  metrics: CompressionMetrics;
  trials: OptimizationTrial[];
}
