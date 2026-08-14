import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runHarness } from "../src/adapters/process.js";

test("generic stdin harness receives replacement prompt, not original", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ltcf-"));
  const capture = join(dir, "capture.mjs");
  const output = join(dir, "received.txt");
  writeFileSync(capture, `import { readFileSync, writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(output)}, readFileSync(0, 'utf8'));\n`);
  const original = Array.from({ length: 60 }, () => "service=orders operation=create_order status=success user_id=123").join("\n");
  const result = await runHarness(original, { command: process.execPath, args: [capture], transport: "stdin" });
  const received = readFileSync(output, "utf8");
  assert.equal(result.exitCode, 0);
  assert.equal(received, result.transform.prompt);
  assert.equal(received.includes(original), false);
  assert.equal(result.transform.decodeLocal(), original);
  assert.ok(result.transform.promptTokens < result.transform.originalTokens);
});

test("disabled compression forwards original prompt unchanged", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ltcf-disabled-"));
  const capture = join(dir, "capture.mjs");
  const output = join(dir, "received.txt");
  writeFileSync(capture, `import { readFileSync, writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(output)}, readFileSync(0, 'utf8'));\n`);
  const original = Array.from({ length: 60 }, () => "service=orders status=success").join("\n");

  const result = await runHarness(original, {
    command: process.execPath,
    args: [capture],
    transport: "stdin",
    enabled: false,
  });

  assert.equal(result.exitCode, 0);
  assert.equal(readFileSync(output, "utf8"), original);
  assert.equal(result.transform.compressed, false);
});
