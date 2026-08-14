import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { serializeSharedDictionary, trainSharedDictionary } from "./shared.js";
export function loadLearningState(statePath) {
    if (!existsSync(statePath)) {
        return { format: "LTCF-STATE/1", observations: [], observationsSinceTrain: 0 };
    }
    const parsed = JSON.parse(readFileSync(statePath, "utf8"));
    if (parsed?.format !== "LTCF-STATE/1" || !Array.isArray(parsed.observations)) {
        throw new Error(`Invalid LTCF learning state: ${statePath}`);
    }
    return parsed;
}
export function observePrompt(prompt, options) {
    const retrainEvery = options.retrainEvery ?? 12;
    const maxSamples = options.maxSamples ?? 24;
    const maxSampleCharacters = options.maxSampleCharacters ?? 8_000;
    const maxEntries = options.maxEntries ?? 24;
    const minSamplesBeforeTrain = options.minSamplesBeforeTrain ?? 1;
    const state = loadLearningState(options.statePath);
    const clipped = prompt.slice(0, maxSampleCharacters);
    state.observations.push(clipped);
    state.observations = state.observations.slice(-maxSamples);
    state.observationsSinceTrain += 1;
    const shouldInitialTrain = !state.dictionary && state.observations.length >= minSamplesBeforeTrain;
    const shouldRetrain = Boolean(state.dictionary) && state.observationsSinceTrain >= retrainEvery;
    if (shouldInitialTrain || shouldRetrain) {
        const version = (state.dictionary?.version ?? 0) + 1;
        state.dictionary = trainSharedDictionary(state.observations, {
            id: options.dictionaryId ?? "project",
            version,
            maxEntries,
            profile: "balanced",
        });
        state.observationsSinceTrain = 0;
    }
    saveLearningState(options.statePath, state);
    return state;
}
export function saveLearningState(statePath, state) {
    mkdirSync(dirname(statePath), { recursive: true });
    const absolute = resolve(statePath);
    const temporary = `${absolute}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    renameSync(temporary, absolute);
}
export function exportCurrentDictionary(statePath) {
    const state = loadLearningState(statePath);
    return state.dictionary ? serializeSharedDictionary(state.dictionary) : null;
}
//# sourceMappingURL=state.js.map