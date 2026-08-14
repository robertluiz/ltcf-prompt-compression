# Architecture

LTCF separates the compression engine from the transport/harness.

```text
                    ┌─────────────────────────┐
original prompt ───►│  transformPrompt()      │
                    │                         │
shared dictionary ─►│  base substitution      │
                    │  adaptive delta search  │
                    │  exact token objective  │
                    └───────────┬─────────────┘
                                │
                     selected model prompt
                                │
          ┌─────────────────────┼──────────────────────┐
          ▼                     ▼                      ▼
   generic callback        process/stdin       OpenAI-compatible JSON
          │                     │                      │
          └─────────────────────┼──────────────────────┘
                                ▼
                         arbitrary harness
```

## Core invariant

The transport gets `PromptTransformResult.prompt`. It does not get both forms.

```ts
const result = transformPrompt(original);
await send(result.prompt);
```

`result.original` exists for metrics/local verification only.

## Standalone mode

Standalone is self-contained:

```text
LTCF standalone ...decoder contract...
D
¤"repeated sequence"
¦"another sequence"
B
encoded ¤ body ¦
```

The optimizer counts every token above before accepting compression.

## Shared-session mode

A shared dictionary is versioned:

```text
LTCF-SHARED/1
id: project
version: 4
entries: ...
checksum: ...
```

The model/runtime first receives a stable bootstrap. Later model prompts may use:

```text
LTCF project@4
D
×"request-local sequence"
B
¤ ... × ...
```

Shared aliases are reserved so the per-request delta cannot reuse them.

## Learning

Learning is orthogonal to invocation. An observer can collect a bounded sample window and retrain a shared dictionary periodically. Codex's `UserPromptSubmit` hook uses this observer, but any harness can call `observePrompt()` directly.

## Future tokenizer adapters

The current compressor discovers candidates from `o200k_base` token IDs. Harness adapters are already independent of this implementation. Future codecs should provide deterministic `encode`, `decodeStrict`, and `count` operations so the optimizer can target provider-specific tokenization without changing the transport layer.
