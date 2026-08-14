import assert from "node:assert/strict";
import test from "node:test";
import { compress, decompress, metrics } from "../src/compressor.js";
import { parseDocument, serializeDocument } from "../src/format.js";
import { TokenCodec } from "../src/tokenizer.js";

test("matches the official o200k_base cookbook vector", () => {
  const codec = new TokenCodec();
  assert.deepEqual(codec.encode("antidisestablishmentarianism"), [
    493, 129901, 376, 160388, 21203, 2367,
  ]);
});

test("o200k tokenizer round-trips multilingual UTF-8", () => {
  const codec = new TokenCodec();
  const input = "Olá, Gijón! 👋🏽 日本語 العربية Русский\nTabs:\tA\tB";
  assert.equal(codec.decode(codec.encode(input)), input);
});

test("round-trips arbitrary UTF-8 text byte-for-byte", () => {
  const input = [
    "Olá, Gijón! 👋\n",
    "Tabs:\tA\tB\n",
    "Quotes: \"hello\" and backslash \\\n",
    "Repeated phrase: React Native com TypeScript.\n".repeat(20),
  ].join("");

  const document = compress(input);
  assert.equal(decompress(document), input);
});

test("serialized document round-trips", () => {
  const input = "customerId=42 status=active\n".repeat(80);
  const document = compress(input);
  const parsed = parseDocument(serializeDocument(document));
  assert.equal(decompress(parsed), input);
});

test("repetitive input reduces payload tokens", () => {
  const input =
    "[INFO] service=orders operation=create status=success duration=18ms\n".repeat(200);
  const result = metrics(compress(input));
  assert.equal(result.losslessVerified, true);
  assert.ok(result.payloadTokens < result.originalTokens);
});

test("non-repetitive short input remains valid when compression is not useful", () => {
  const input = "Texto curto sem repetição suficiente.";
  const document = compress(input);
  assert.equal(decompress(document), input);
});

test("balanced alias index exposes 64 one-token symbols", async () => {
  const { buildAliasIndex } = await import("../src/aliases.js");
  const codec = new TokenCodec();
  const aliases = buildAliasIndex(codec, 64);
  assert.equal(aliases.length, 64);
  assert.ok(aliases.every((entry) => entry.tokenCost === 1));
  assert.equal(new Set(aliases.map((entry) => entry.symbol)).size, 64);
});

test("active dictionary stops before the 64-entry cap", () => {
  const input = "service=orders status=success duration_ms=17\n".repeat(160);
  const document = compress(input, { maxEntries: 64 });
  assert.ok(document.dictionary.length > 0);
  assert.ok(document.dictionary.length < 64);
  assert.ok(document.dictionary.every((entry) => entry.exactMarginalSaving > 0));
});
