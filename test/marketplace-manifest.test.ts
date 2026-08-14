import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Codex marketplace uses accepted policy values and a contained source path", () => {
  const marketplace = JSON.parse(readFileSync(".agents/plugins/marketplace.json", "utf8"));
  const plugin = marketplace.plugins.find((entry: { name?: string }) => entry.name === "ltcf-prompt-compression");

  assert.ok(plugin, "LTCF marketplace entry is missing");
  assert.ok(
    ["ON_INSTALL", "ON_USE"].includes(plugin.policy.authentication),
    `unsupported authentication policy: ${plugin.policy.authentication}`,
  );
  assert.ok(plugin.source.path.startsWith("./"), `source path must start with ./: ${plugin.source.path}`);
  assert.equal(plugin.source.path.includes(".."), false, `source path escapes marketplace root: ${plugin.source.path}`);
});
