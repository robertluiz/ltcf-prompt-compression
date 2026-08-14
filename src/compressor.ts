import { Buffer } from "node:buffer";
import { generateAliases } from "./aliases.js";
import { sha256 } from "./checksum.js";
import {
  DECODER_CONTRACT,
  renderDictionary,
  renderDictionaryEntry,
  renderPayload,
  serializeDocument,
} from "./format.js";
import { TokenCodec } from "./tokenizer.js";
import type {
  CompressedDocument,
  CompressionMetrics,
  CompressionOptions,
  DictionaryEntry,
} from "./types.js";

interface Candidate {
  value: string;
  tokenLength: number;
  nonOverlappingOccurrences: number;
  roughSaving: number;
}

export const DEFAULT_COMPRESSION_OPTIONS: Required<CompressionOptions> = {
  encoding: "o200k_base",
  maxEntries: 64,
  maxNgramTokens: 32,
  candidateLimit: 1_000,
  exactCandidatesPerRound: 64,
  minCandidateCharacters: 3,
  minRuleTokenSaving: 1,
  reservedAliases: [],
};

/**
 * Builds an adaptive dictionary using a greedy Minimum Description Length
 * objective. Each rule is accepted only when the exact rendered payload becomes
 * smaller after including both the dictionary line and every replacement.
 */
export function compress(
  original: string,
  options: CompressionOptions = {},
): CompressedDocument {
  const config = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };
  validateOptions(config);

  const codec = new TokenCodec(config.encoding);
  const originalTokenIds = codec.encode(original);
  const aliasExclusionSource = `${original}${config.reservedAliases.join("")}`;
  const aliases = generateAliases(codec, aliasExclusionSource, config.maxEntries);
  const candidates = discoverCandidates(
    originalTokenIds,
    codec,
    config.maxNgramTokens,
    config.candidateLimit,
    config.minCandidateCharacters,
  );

  let body = original;
  const dictionary: DictionaryEntry[] = [];

  for (let round = 0; round < config.maxEntries; round += 1) {
    const alias = aliases[round];
    if (!alias) break;

    const currentDocument = createDocument(original, codec, dictionary, body);
    const currentPayloadTokens = codec.count(renderPayload(currentDocument));

    const ranked = candidates
      .filter((candidate) => !dictionary.some((entry) => entry.value === candidate.value))
      .map((candidate) => rankCandidate(candidate, alias, body, codec))
      .filter((candidate): candidate is RankedCandidate => candidate !== null)
      .sort((a, b) => b.estimatedSaving - a.estimatedSaving)
      .slice(0, config.exactCandidatesPerRound);

    let best:
      | {
          body: string;
          entry: DictionaryEntry;
          payloadTokens: number;
        }
      | undefined;

    for (const rankedCandidate of ranked) {
      const nextBody = replaceAllLiteral(body, rankedCandidate.value, alias);
      const provisionalEntry: DictionaryEntry = {
        alias,
        value: rankedCandidate.value,
        occurrences: rankedCandidate.occurrences,
        valueTokens: codec.count(rankedCandidate.value),
        aliasTokens: codec.count(alias),
        estimatedNetSaving: rankedCandidate.estimatedSaving,
        exactMarginalSaving: 0,
      };
      const provisionalDocument = createDocument(
        original,
        codec,
        [...dictionary, provisionalEntry],
        nextBody,
      );
      const nextPayloadTokens = codec.count(renderPayload(provisionalDocument));
      const exactMarginalSaving = currentPayloadTokens - nextPayloadTokens;

      if (exactMarginalSaving < config.minRuleTokenSaving) continue;
      if (!best || nextPayloadTokens < best.payloadTokens) {
        best = {
          body: nextBody,
          entry: { ...provisionalEntry, exactMarginalSaving },
          payloadTokens: nextPayloadTokens,
        };
      }
    }

    // This is the equilibrium point: no remaining candidate can pay for its
    // own dictionary entry under the exact target tokenizer.
    if (!best) break;
    dictionary.push(best.entry);
    body = best.body;
  }

  const document = createDocument(original, codec, dictionary, body);
  const restored = decompress(document);
  if (restored !== original) {
    throw new Error("Internal lossless verification failed after compression.");
  }
  return document;
}

interface RankedCandidate extends Candidate {
  occurrences: number;
  estimatedSaving: number;
}

function rankCandidate(
  candidate: Candidate,
  alias: string,
  body: string,
  codec: TokenCodec,
): RankedCandidate | null {
  const occurrences = countNonOverlapping(body, candidate.value);
  if (occurrences < 2) return null;

  const aliasTokens = codec.count(alias);
  const valueTokens = codec.count(candidate.value);
  const dictionaryLineTokens = codec.count(
    `${renderDictionaryEntry({ alias, value: candidate.value })}\n`,
  );
  const estimatedSaving =
    occurrences * valueTokens -
    occurrences * aliasTokens -
    dictionaryLineTokens;

  if (estimatedSaving <= 0) return null;
  return { ...candidate, occurrences, estimatedSaving };
}

function createDocument(
  original: string,
  codec: TokenCodec,
  dictionary: DictionaryEntry[],
  body: string,
): CompressedDocument {
  return {
    format: "LTCF/2",
    encoding: codec.name,
    checksumSha256: sha256(original),
    originalBytes: Buffer.byteLength(original, "utf8"),
    originalTokens: codec.count(original),
    dictionary,
    body,
  };
}

export function decompress(document: CompressedDocument): string {
  let restored = document.body;
  // Reverse order keeps the decoder safe if hierarchical entries are added later.
  for (let index = document.dictionary.length - 1; index >= 0; index -= 1) {
    const entry = document.dictionary[index];
    if (!entry) continue;
    restored = replaceAllLiteral(restored, entry.alias, entry.value);
  }

  const checksum = sha256(restored);
  if (checksum !== document.checksumSha256) {
    throw new Error(
      `Checksum mismatch. Expected ${document.checksumSha256}, received ${checksum}.`,
    );
  }
  return restored;
}

export function metrics(document: CompressedDocument): CompressionMetrics {
  const codec = new TokenCodec(document.encoding);
  const restored = decompress(document);
  const payloadTokens = codec.count(renderPayload(document));
  const decoderContractTokens = codec.count(DECODER_CONTRACT);
  const promptWithDecoderTokens = codec.count(
    `${DECODER_CONTRACT}\n${renderPayload(document)}`,
  );
  const originalTokens = codec.count(restored);
  const bodyTokens = codec.count(document.body);
  const dictionaryTokens = codec.count(renderDictionary(document));
  const tokenSavingPayload = originalTokens - payloadTokens;
  const tokenSavingWithDecoder = originalTokens - promptWithDecoderTokens;

  return {
    originalBytes: Buffer.byteLength(restored, "utf8"),
    compressedStorageBytes: Buffer.byteLength(serializeDocument(document), "utf8"),
    originalTokens,
    bodyTokens,
    dictionaryTokens,
    payloadTokens,
    decoderContractTokens,
    promptWithDecoderTokens,
    tokenSavingPayload,
    tokenSavingWithDecoder,
    tokenReductionPayloadPercent:
      originalTokens === 0 ? 0 : (tokenSavingPayload / originalTokens) * 100,
    tokenReductionWithDecoderPercent:
      originalTokens === 0 ? 0 : (tokenSavingWithDecoder / originalTokens) * 100,
    dictionaryEntries: document.dictionary.length,
    losslessVerified: sha256(restored) === document.checksumSha256,
    useCompressedPrompt: promptWithDecoderTokens < originalTokens,
  };
}

function discoverCandidates(
  tokenIds: number[],
  codec: TokenCodec,
  maxNgramTokens: number,
  candidateLimit: number,
  minCandidateCharacters: number,
): Candidate[] {
  const candidates: Candidate[] = [];
  const maxLength = Math.min(maxNgramTokens, Math.max(0, tokenIds.length - 1));

  for (let length = 2; length <= maxLength; length += 1) {
    const occurrences = new Map<
      string,
      { count: number; firstStart: number; lastAcceptedEnd: number }
    >();

    for (let start = 0; start + length <= tokenIds.length; start += 1) {
      const key = tokenIds.slice(start, start + length).join(",");
      const existing = occurrences.get(key);
      if (!existing) {
        occurrences.set(key, {
          count: 1,
          firstStart: start,
          lastAcceptedEnd: start + length,
        });
        continue;
      }
      if (start >= existing.lastAcceptedEnd) {
        existing.count += 1;
        existing.lastAcceptedEnd = start + length;
      }
    }

    for (const value of occurrences.values()) {
      if (!meetsOptimisticCompressionCondition(length, value.count)) continue;
      const text = codec.decodeStrict(
        tokenIds.slice(value.firstStart, value.firstStart + length),
      );
      if (text === null || text.length < minCandidateCharacters) continue;
      if (text.trim().length === 0) continue;

      // Optimistic pre-filter only. Exact prompt tokenization is measured later.
      const roughSaving = length * value.count - (1 + length + value.count);
      if (roughSaving <= 0) continue;
      candidates.push({
        value: text,
        tokenLength: length,
        nonOverlappingOccurrences: value.count,
        roughSaving,
      });
    }
  }

  const byValue = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const current = byValue.get(candidate.value);
    if (!current || candidate.roughSaving > current.roughSaving) {
      byValue.set(candidate.value, candidate);
    }
  }

  return [...byValue.values()]
    .sort((a, b) => {
      if (b.roughSaving !== a.roughSaving) return b.roughSaving - a.roughSaving;
      return b.tokenLength - a.tokenLength;
    })
    .slice(0, candidateLimit);
}

function meetsOptimisticCompressionCondition(length: number, count: number): boolean {
  return length * count > 1 + length + count;
}

function countNonOverlapping(text: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let cursor = 0;
  while (cursor <= text.length - needle.length) {
    const index = text.indexOf(needle, cursor);
    if (index === -1) break;
    count += 1;
    cursor = index + needle.length;
  }
  return count;
}

function replaceAllLiteral(text: string, needle: string, replacement: string): string {
  if (needle.length === 0) return text;
  return text.split(needle).join(replacement);
}

function validateOptions(options: Required<CompressionOptions>): void {
  const positiveIntegers: Array<[string, number]> = [
    ["maxEntries", options.maxEntries],
    ["maxNgramTokens", options.maxNgramTokens],
    ["candidateLimit", options.candidateLimit],
    ["exactCandidatesPerRound", options.exactCandidatesPerRound],
    ["minCandidateCharacters", options.minCandidateCharacters],
    ["minRuleTokenSaving", options.minRuleTokenSaving],
  ];
  for (const [name, value] of positiveIntegers) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error(`${name} must be a positive integer.`);
    }
  }
}
