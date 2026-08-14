import test from "node:test";
import assert from "node:assert/strict";
import { invokeWithCompression } from "../src/adapters/generic.js";

test("generic adapter exposes only the selected model prompt to a harness", async () => {
  const original = Array.from({ length: 80 }, () =>
    "service=orders operation=create_order status=success user_id=123",
  ).join("\n");

  let received = "";
  const invocation = await invokeWithCompression(original, async (modelPrompt) => {
    received = modelPrompt;
    return { ok: true };
  });

  assert.equal(received, invocation.transform.prompt);
  assert.equal(invocation.response.ok, true);
  assert.ok(invocation.transform.compressed);
  assert.ok(invocation.transform.promptTokens < invocation.transform.originalTokens);
  assert.equal(invocation.transform.decodeLocal(), original);
  assert.equal(received.includes(original), false);
});
