import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { observePrompt } from "./state.js";

async function main(): Promise<void> {
  const input = await readStdin();
  if (!input.trim()) return;
  const payload = JSON.parse(input) as Record<string, unknown>;
  const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
  if (!prompt) return;

  const dataRoot = process.env.PLUGIN_DATA ?? process.env.CLAUDE_PLUGIN_DATA ?? join(process.cwd(), ".ltcf");
  mkdirSync(dataRoot, { recursive: true });
  observePrompt(prompt, {
    statePath: join(dataRoot, "state.json"),
    dictionaryId: projectId(payload.cwd),
    minSamplesBeforeTrain: 4,
    retrainEvery: 12,
    maxSamples: 16,
    maxSampleCharacters: 4_000,
    maxEntries: 16,
  });

  // Intentionally emit no additionalContext. Current Codex UserPromptSubmit
  // hooks can add context or block, but cannot replace the original prompt.
  // This hook is therefore learning-only; actual replacement lives in the
  // harness-agnostic wrapper/API layer.
}

function projectId(cwd: unknown): string {
  if (typeof cwd !== "string" || !cwd) return "project";
  return cwd.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-64) || "project";
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
