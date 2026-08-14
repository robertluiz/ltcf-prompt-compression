import { type SharedDictionary } from "./shared.js";
export interface LearningState {
    format: "LTCF-STATE/1";
    observations: string[];
    observationsSinceTrain: number;
    dictionary?: SharedDictionary;
}
export interface ObserveOptions {
    statePath: string;
    dictionaryId?: string;
    retrainEvery?: number;
    maxSamples?: number;
    maxSampleCharacters?: number;
    maxEntries?: number;
    minSamplesBeforeTrain?: number;
}
export declare function loadLearningState(statePath: string): LearningState;
export declare function observePrompt(prompt: string, options: ObserveOptions): LearningState;
export declare function saveLearningState(statePath: string, state: LearningState): void;
export declare function exportCurrentDictionary(statePath: string): string | null;
