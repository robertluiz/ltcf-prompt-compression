import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

test("Codex hook learns locally and emits no model context", async () => {
  const dataRoot = mkdtempSync(join(tmpdir(), "ltcf-codex-hook-"));
  const hook = new URL("../src/hook-codex.js", import.meta.url);
  const payload = JSON.stringify({
    hook_event_name: "UserPromptSubmit",
    prompt: "service=orders status=success service=orders status=success",
    cwd: "/tmp/project",
  });

  const result = await new Promise<{ code: number; stdout: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [hook.pathname], {
      env: { ...process.env, PLUGIN_DATA: dataRoot },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.once("error", reject);
    child.once("exit", (code: number | null) => resolve({ code: code ?? 1, stdout }));
    child.stdin.end(payload);
  });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "");
  const statePath = join(dataRoot, "state.json");
  assert.equal(existsSync(statePath), true);
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  assert.equal(state.format, "LTCF-STATE/1");
  assert.equal(state.observations.length, 1);
  assert.equal(state.dictionary, undefined);
});
