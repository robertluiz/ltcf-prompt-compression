import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("CLI lifecycle works end-to-end without touching Codex", () => {
  const home = mkdtempSync(join(tmpdir(), "ltcf-cli-lifecycle-"));
  try {
    const installed = run(home, "install", "--no-codex");
    assert.equal(installed.installed, true);
    assert.equal(installed.enabled, true);
    assert.equal(installed.codexMarketplace, false);
    assert.equal(run(home, "disable").enabled, false);
    assert.equal(run(home, "enable").enabled, true);
    assert.equal(run(home, "status").installed, true);
    assert.equal(run(home, "uninstall", "--no-codex").installed, false);

    const config = JSON.parse(readFileSync(join(home, "config.json"), "utf8"));
    assert.equal(config.enabled, false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

function run(home: string, ...args: string[]): Record<string, unknown> {
  const result = spawnSync(process.execPath, [resolve("dist/src/cli.js"), ...args, "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, LTCF_HOME: home },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
