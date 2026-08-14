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
export declare function trainSharedDictionary(samples: readonly string[], options?: TrainSharedDictionaryOptions): SharedDictionary;
export declare function createSharedDictionary(id: string, version: number, entries: readonly SharedDictionaryEntry[], encoding?: EncodingName): SharedDictionary;
export declare function applySharedDictionary(input: string, dictionary: SharedDictionary): {
    body: string;
    used: SharedDictionaryEntry[];
};
export declare function expandSharedDictionary(input: string, dictionary: SharedDictionary): string;
export declare function renderSharedBootstrap(dictionary: SharedDictionary): string;
export declare function parseSharedDictionary(serialized: string): SharedDictionary;
export declare function serializeSharedDictionary(dictionary: SharedDictionary): string;
export declare function chooseStableAliases(count: number): string[];
export declare function toDictionaryEntries(entries: readonly SharedDictionaryEntry[]): DictionaryEntry[];
