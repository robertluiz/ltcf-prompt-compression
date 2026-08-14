import { createHash } from "node:crypto";
import { BALANCED_ALIAS_SYMBOLS } from "./aliases.js";
import { optimizeCompression } from "./optimizer.js";
import { TokenCodec } from "./tokenizer.js";
import type { DictionaryEntry, EncodingName, OptimizationProfile } from "./types.js";

export interface SharedDictionaryEntry {
  alias: string;
  value: string;
}

export interface SharedDictionary {
  format: "LTCF-SHARED/1";
  id: string;
  version: number;
  encoding: EncodingName;
  entries: SharedDictionaryEntry[];
  checksumSha256: string;
}

export interface TrainSharedDictionaryOptions {
  id?: string;
  version?: number;
  maxEntries?: number;
  profile?: OptimizationProfile;
  encoding?: EncodingName;
}

export function trainSharedDictionary(
  samples: readonly string[],
  options: TrainSharedDictionaryOptions = {},
): SharedDictionary {
  const encoding = options.encoding ?? "o200k_base";
  const codec = new TokenCodec(encoding);
  const corpus = samples.filter(Boolean).join("\n\u241eLTCF_SAMPLE\u241e\n");
  if (!corpus) {
    return finalizeDictionary({
      format: "LTCF-SHARED/1",
      id: options.id ?? "default",
      version: options.version ?? 1,
      encoding,
      entries: [],
      checksumSha256: "",
    });
  }

  const optimized = optimizeCompression(corpus, options.profile ?? "balanced", {
    encoding,
    maxEntries: options.maxEntries ?? 32,
  });

  const entries: SharedDictionaryEntry[] = optimized.document.dictionary
    .slice(0, options.maxEntries ?? 32)
    .map(({ alias, value }) => ({ alias, value }))
    .filter(({ alias, value }) => codec.count(alias) <= codec.count(value));

  return finalizeDictionary({
    format: "LTCF-SHARED/1",
    id: options.id ?? "default",
    version: options.version ?? 1,
    encoding,
    entries,
    checksumSha256: "",
  });
}

export function createSharedDictionary(
  id: string,
  version: number,
  entries: readonly SharedDictionaryEntry[],
  encoding: EncodingName = "o200k_base",
): SharedDictionary {
  const codec = new TokenCodec(encoding);
  const seenAliases = new Set<string>();
  const seenValues = new Set<string>();
  const normalized: SharedDictionaryEntry[] = [];

  for (const entry of entries) {
    if (!entry.alias || !entry.value) continue;
    if (seenAliases.has(entry.alias) || seenValues.has(entry.value)) continue;
    if (codec.count(entry.alias) > codec.count(entry.value)) continue;
    seenAliases.add(entry.alias);
    seenValues.add(entry.value);
    normalized.push({ alias: entry.alias, value: entry.value });
  }

  return finalizeDictionary({
    format: "LTCF-SHARED/1",
    id,
    version,
    encoding,
    entries: normalized,
    checksumSha256: "",
  });
}

export function applySharedDictionary(
  input: string,
  dictionary: SharedDictionary,
): { body: string; used: SharedDictionaryEntry[] } {
  const codec = new TokenCodec(dictionary.encoding);
  let body = input;
  const used: SharedDictionaryEntry[] = [];

  const ranked = [...dictionary.entries]
    .filter((entry) => !input.includes(entry.alias))
    .map((entry) => {
      const occurrences = countNonOverlapping(body, entry.value);
      const saving = occurrences * (codec.count(entry.value) - codec.count(entry.alias));
      return { ...entry, occurrences, saving };
    })
    .filter((entry) => entry.occurrences > 0 && entry.saving > 0)
    .sort((a, b) => b.saving - a.saving || b.value.length - a.value.length);

  for (const entry of ranked) {
    if (body.includes(entry.alias)) continue;
    const occurrences = countNonOverlapping(body, entry.value);
    if (occurrences === 0) continue;
    if (occurrences * (codec.count(entry.value) - codec.count(entry.alias)) <= 0) continue;
    body = body.split(entry.value).join(entry.alias);
    used.push({ alias: entry.alias, value: entry.value });
  }

  return { body, used };
}

export function expandSharedDictionary(
  input: string,
  dictionary: SharedDictionary,
): string {
  let value = input;
  for (let index = dictionary.entries.length - 1; index >= 0; index -= 1) {
    const entry = dictionary.entries[index];
    if (!entry) continue;
    value = value.split(entry.alias).join(entry.value);
  }
  return value;
}

export function renderSharedBootstrap(dictionary: SharedDictionary): string {
  const lines = dictionary.entries.map((entry) => `${entry.alias}${JSON.stringify(entry.value)}`);
  return [
    `LTCF shared dictionary ${dictionary.id}@${dictionary.version}.`,
    "When a user message starts with LTCF, expand shared aliases, then D aliases, before reasoning. Preserve all other content exactly.",
    "S",
    ...lines,
  ].join("\n");
}

export function parseSharedDictionary(serialized: string): SharedDictionary {
  const value = JSON.parse(serialized) as SharedDictionary;
  if (value?.format !== "LTCF-SHARED/1" || typeof value.id !== "string" || !Array.isArray(value.entries)) {
    throw new Error("Invalid LTCF shared dictionary.");
  }
  const expected = value.checksumSha256;
  const normalized = finalizeDictionary({ ...value, checksumSha256: "" });
  if (expected && normalized.checksumSha256 !== expected) {
    throw new Error("Shared dictionary checksum mismatch.");
  }
  return normalized;
}

export function serializeSharedDictionary(dictionary: SharedDictionary): string {
  return `${JSON.stringify(dictionary, null, 2)}\n`;
}

export function chooseStableAliases(count: number): string[] {
  return BALANCED_ALIAS_SYMBOLS.slice(0, Math.max(0, count)) as unknown as string[];
}

function finalizeDictionary(dictionary: SharedDictionary): SharedDictionary {
  const material = JSON.stringify({
    format: dictionary.format,
    id: dictionary.id,
    version: dictionary.version,
    encoding: dictionary.encoding,
    entries: dictionary.entries,
  });
  return {
    ...dictionary,
    checksumSha256: createHash("sha256").update(material, "utf8").digest("hex"),
  };
}

function countNonOverlapping(text: string, needle: string): number {
  if (!needle) return 0;
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

export function toDictionaryEntries(entries: readonly SharedDictionaryEntry[]): DictionaryEntry[] {
  return entries.map((entry) => ({
    alias: entry.alias,
    value: entry.value,
    occurrences: 0,
    valueTokens: 0,
    aliasTokens: 0,
    estimatedNetSaving: 0,
    exactMarginalSaving: 0,
  }));
}
