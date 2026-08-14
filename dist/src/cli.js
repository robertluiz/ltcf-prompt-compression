#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSharedDictionary, renderSharedBootstrap, serializeSharedDictionary, trainSharedDictionary } from "./shared.js";
import { transformPrompt } from "./transform.js";
import { runHarness } from "./adapters/process.js";
import { exportCurrentDictionary, observePrompt } from "./state.js";
async function main() {
    const [command, ...args] = process.argv.slice(2);
    switch (command) {
        case "transform": return transformCommand(args);
        case "train": return trainCommand(args);
        case "bootstrap": return bootstrapCommand(args);
        case "observe": return observeCommand(args);
        case "export": return exportCommand(args);
        case "run": return runCommand(args);
        case "benchmark": return benchmarkCommand(args);
        default:
            printUsage();
            process.exitCode = command ? 2 : 0;
    }
}
function transformCommand(args) {
    const inputPath = valueAfter(args, "--input");
    const dictionaryPath = valueAfter(args, "--dictionary");
    const sessionMode = args.includes("--session");
    const original = inputPath ? readFileSync(resolve(inputPath), "utf8") : readStdinSync();
    const dictionary = dictionaryPath ? parseSharedDictionary(readFileSync(resolve(dictionaryPath), "utf8")) : undefined;
    const result = transformPrompt(original, { sharedDictionary: dictionary, sessionMode });
    process.stdout.write(result.prompt);
    if (args.includes("--metrics")) {
        process.stderr.write(`\n${JSON.stringify(summary(result), null, 2)}\n`);
    }
}
function trainCommand(args) {
    const output = valueAfter(args, "--output") ?? "ltcf.dictionary.json";
    const id = valueAfter(args, "--id") ?? "project";
    const files = positionalAfterDoubleDash(args);
    if (files.length === 0)
        throw new Error("train requires corpus files after --");
    const samples = files.map((file) => readFileSync(resolve(file), "utf8"));
    const dictionary = trainSharedDictionary(samples, { id });
    writeFileSync(resolve(output), serializeSharedDictionary(dictionary), "utf8");
    process.stdout.write(`${resolve(output)}\n`);
}
function bootstrapCommand(args) {
    const dictionaryPath = valueAfter(args, "--dictionary");
    if (!dictionaryPath)
        throw new Error("bootstrap requires --dictionary <file>");
    const dictionary = parseSharedDictionary(readFileSync(resolve(dictionaryPath), "utf8"));
    process.stdout.write(`${renderSharedBootstrap(dictionary)}\n`);
}
function observeCommand(args) {
    const statePath = valueAfter(args, "--state") ?? ".ltcf/state.json";
    const inputPath = valueAfter(args, "--input");
    const prompt = inputPath ? readFileSync(resolve(inputPath), "utf8") : readStdinSync();
    const state = observePrompt(prompt, { statePath: resolve(statePath) });
    process.stdout.write(JSON.stringify({ observations: state.observations.length, dictionaryVersion: state.dictionary?.version ?? 0 }) + "\n");
}
function exportCommand(args) {
    const statePath = valueAfter(args, "--state") ?? ".ltcf/state.json";
    const output = valueAfter(args, "--output") ?? "ltcf.dictionary.json";
    const dictionary = exportCurrentDictionary(resolve(statePath));
    if (!dictionary)
        throw new Error("No trained dictionary exists in the learning state yet.");
    writeFileSync(resolve(output), dictionary, "utf8");
    process.stdout.write(`${resolve(output)}\n`);
}
async function runCommand(args) {
    const divider = args.indexOf("--");
    if (divider === -1 || divider === args.length - 1)
        throw new Error("run requires -- <command> [args...]");
    const transport = args.includes("--argument") ? "argument" : "stdin";
    const inputPath = valueAfter(args, "--input");
    const dictionaryPath = valueAfter(args, "--dictionary");
    const sessionMode = args.includes("--session");
    const prompt = inputPath ? readFileSync(resolve(inputPath), "utf8") : readStdinSync();
    const dictionary = dictionaryPath ? parseSharedDictionary(readFileSync(resolve(dictionaryPath), "utf8")) : undefined;
    const command = args[divider + 1];
    if (!command)
        throw new Error("Missing child command.");
    const childArgs = args.slice(divider + 2);
    const result = await runHarness(prompt, {
        command,
        args: childArgs,
        transport,
        sharedDictionary: dictionary,
        sessionMode,
    });
    process.stderr.write(`${JSON.stringify(summary(result.transform))}\n`);
    process.exitCode = result.exitCode;
}
function benchmarkCommand(args) {
    const inputPath = valueAfter(args, "--input");
    if (!inputPath)
        throw new Error("benchmark requires --input <file>");
    const dictionaryPath = valueAfter(args, "--dictionary");
    const original = readFileSync(resolve(inputPath), "utf8");
    const dictionary = dictionaryPath ? parseSharedDictionary(readFileSync(resolve(dictionaryPath), "utf8")) : undefined;
    const standalone = transformPrompt(original);
    const shared = dictionary ? transformPrompt(original, { sharedDictionary: dictionary, sessionMode: true }) : undefined;
    process.stdout.write(`${JSON.stringify({ standalone: summary(standalone), sharedSession: shared ? summary(shared) : null }, null, 2)}\n`);
}
function summary(result) {
    return {
        compressed: result.compressed,
        mode: result.mode,
        originalTokens: result.originalTokens,
        promptTokens: result.promptTokens,
        savedTokens: result.savedTokens,
        reductionPercent: Number(result.reductionPercent.toFixed(2)),
        sharedAliasesUsed: result.sharedAliasesUsed,
        deltaAliasesUsed: result.deltaAliasesUsed,
        lossless: result.decodeLocal() === result.original,
    };
}
function valueAfter(args, flag) {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
}
function positionalAfterDoubleDash(args) {
    const index = args.indexOf("--");
    return index === -1 ? [] : args.slice(index + 1);
}
function readStdinSync() {
    return readFileSync(0, "utf8");
}
function printUsage() {
    process.stdout.write(`LTCF\n\n` +
        `  ltcf transform [--input file] [--dictionary file --session] [--metrics]\n` +
        `  ltcf train --output dictionary.json -- file1 file2 ...\n` +
        `  ltcf bootstrap --dictionary dictionary.json\n` +
        `  ltcf observe [--state file] [--input file]\n` +
        `  ltcf export [--state file] [--output dictionary.json]\n` +
        `  ltcf benchmark --input file [--dictionary file]\n` +
        `  ltcf run [--input file] [--dictionary file --session] [--argument] -- <command> [args...]\n`);
}
main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
});
//# sourceMappingURL=cli.js.map