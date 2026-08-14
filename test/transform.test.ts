import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { transformPrompt } from "../src/transform.js";
import { createSharedDictionary, renderSharedBootstrap } from "../src/shared.js";

const logs = readFileSync(join(process.cwd(), "samples", "repetitive-logs.txt"), "utf8");
const prose = readFileSync(join(process.cwd(), "samples", "repetitive-text.txt"), "utf8");

test("replace mode sends only the optimized prompt and is lossless locally", () => {
  const result = transformPrompt(logs);
  assert.equal(result.compressed, true);
  assert.ok(result.promptTokens < result.originalTokens);
  assert.equal(result.decodeLocal(), logs);
  assert.notEqual(result.prompt, logs);
  assert.ok(result.reductionPercent > 50);
});

test("small non-repetitive input is left untouched", () => {
  const text = "Fix the failing unit test.";
  const result = transformPrompt(text);
  assert.equal(result.compressed, false);
  assert.equal(result.prompt, text);
  assert.equal(result.decodeLocal(), text);
});

test("shared-session dictionary reduces per-request overhead", () => {
  const dictionary = createSharedDictionary("demo", 1, [
    { alias: "¤", value: "React Native com TypeScript" },
    { alias: "¦", value: "desenvolvimento da aplicação" },
  ]);
  const text = Array.from({ length: 30 }, () =>
    "React Native com TypeScript é usado no desenvolvimento da aplicação."
  ).join("\n");
  const result = transformPrompt(text, { sharedDictionary: dictionary, sessionMode: true });
  assert.equal(result.compressed, true);
  assert.equal(result.mode, "shared-session");
  assert.equal(result.decodeLocal(), text);
  assert.ok(result.sharedAliasesUsed >= 1);
  assert.ok(result.promptTokens < result.originalTokens);
  assert.match(renderSharedBootstrap(dictionary), /demo@1/);
});

test("standalone repeated prose remains lossless", () => {
  const result = transformPrompt(prose);
  assert.equal(result.decodeLocal(), prose);
  assert.ok(result.promptTokens <= result.originalTokens);
});
