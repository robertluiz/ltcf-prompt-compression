# Codex integration

LTCF supports Codex in two separate ways because current hook semantics and prompt replacement are different concerns.

## 1. Plugin hook: learning

`hooks/hooks.json` registers `UserPromptSubmit` and runs `dist/src/hook-codex.js`.

The hook reads the submitted prompt and updates a bounded local learning state under `PLUGIN_DATA` (with `CLAUDE_PLUGIN_DATA` compatibility fallback). It writes no `additionalContext`, because adding the compressed prompt next to the original would increase model input.

## 2. Pre-harness wrapper: replacement

For actual token reduction, run Codex with LTCF in front of it:

```bash
cat prompt.txt | ltcf run -- codex exec -
```

The process adapter transforms stdin first and sends only the selected prompt to Codex.

## Why not mutate UserPromptSubmit?

As of the current Codex source, `UserPromptSubmit` receives `prompt`, and the parsed hook outcome can block/stop processing or contribute `additionalContext`. The outcome does not expose a replacement-prompt field. LTCF therefore does not claim that this hook can mutate the user prompt.

Relevant upstream files:

- https://github.com/openai/codex/blob/main/codex-rs/hooks/schema/generated/user-prompt-submit.command.input.schema.json
- https://github.com/openai/codex/blob/main/codex-rs/hooks/src/events/user_prompt_submit.rs

## Plugin packaging

The manifest declares both the skill directory and the hook config:

```json
{
  "skills": "./skills/",
  "hooks": "./hooks/hooks.json"
}
```

Codex's plugin hook discovery provides plugin-scoped environment variables including `PLUGIN_ROOT` and `PLUGIN_DATA`, which the packaged hook uses for script and state paths.

Upstream references:

- https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/plugin-creator/references/plugin-json-spec.md
- https://github.com/openai/codex/blob/main/codex-rs/hooks/src/engine/discovery.rs

## `codex exec` stdin

Current `codex exec` source reads a prompt from stdin when no positional prompt is supplied, and `-` explicitly forces stdin prompt mode. LTCF uses `-` in examples to make the intent explicit.

- https://github.com/openai/codex/blob/main/codex-rs/exec/src/lib.rs
