# LTCF Prompt Compression

**Harness-agnostic, lossless prompt transformation for repetitive LLM context.**

LTCF replaces repeated token sequences with compact one-token aliases. It minimizes the **actual model prompt** (body + dictionary + decoder contract), not just bytes, and falls back to the original prompt whenever compression does not produce a positive net saving.

```text
original prompt
      │
      ▼
 token-aware optimizer ── no net saving ──► original prompt
      │
      ├── shared dictionary (optional)
      ├── per-request delta dictionary
      ▼
 compressed model prompt
      │
      ▼
  any harness / model API
```

The core has no Codex dependency. Codex is one optional integration.

## Why LTCF

Traditional gzip/zstd output is excellent for bytes but poor as direct LLM input: binary data must be encoded as text and becomes effectively random to the tokenizer. LTCF keeps a text representation the model can expand using a small deterministic dictionary contract.

A rule is accepted only when it reduces the complete tokenized payload:

```text
J(D) = tokens(decoder contract + dictionary D + encoded body)
```

The adaptive index exposes up to 64 aliases, but **unused aliases cost zero prompt tokens**. The optimizer stops as soon as no remaining rule pays for its own dictionary entry.

## Replace, never append

This is the most important integration invariant:

```ts
const transformed = transformPrompt(original);
await harness.send(transformed.prompt); // only this value is sent
```

Do not send `original + transformed.prompt`. That destroys the saving.

The generic adapter enforces the same pattern:

```ts
import { invokeWithCompression } from "ltcf-prompt-compression/adapters/generic";

const result = await invokeWithCompression(originalPrompt, async (modelPrompt) => {
  return myHarness.send(modelPrompt);
});

console.log(result.transform.reductionPercent);
```

## Current benchmark

Measured locally with the included `o200k_base` tokenizer. The final prompt includes the standalone decode instruction, active dictionary and compressed body.

| Sample | Original | Final prompt | Active aliases | Reduction |
|---|---:|---:|---:|---:|
| Repetitive logs, 160 lines | 6,576 | 1,564 | 5 | **76.22%** |
| Repetitive Portuguese prose | 210 | 92 | 2 | **56.19%** |
| Short non-repetitive text | unchanged | unchanged | 0 | 0% |

For a request drawn from the same domain as a previously trained dictionary:

| Mode | Request tokens | Final request | Reduction |
|---|---:|---:|---:|
| Standalone | 2,465 | 688 | **72.09%** |
| Shared dictionary + request delta | 2,465 | 530 | **78.50%** |

The shared dictionary in that test contained 5 entries and its bootstrap was 116 tokens. See [Shared dictionaries](#shared-dictionaries) for the accounting caveat.

## Lossless guarantee

Local decoding is deterministic and verified by SHA-256:

```ts
const result = transformPrompt(text);
const restored = result.decodeLocal();

console.log(restored === text); // true
```

This guarantees the **format/decoder**, not an LLM's probabilistic ability to follow the expansion instruction. Model-level exact-match accuracy must be benchmarked separately for each target model.

## Install, control and remove

Requirements:

- Node.js 22+
- TypeScript 5.8+ for source builds

Install directly from GitHub and register the LTCF marketplace in Codex:

```bash
npm install --global github:robertluiz/ltcf-prompt-compression
ltcf install
```

Control LTCF with one command:

```bash
ltcf status
ltcf disable
ltcf enable
ltcf uninstall
```

`disable` immediately makes the Codex learning hook and `ltcf run` pass prompts through unchanged. It preserves dictionaries and learning data. `uninstall` removes the Codex marketplace registration but also preserves data by default. To remove LTCF-managed data too:

```bash
ltcf uninstall --purge
npm uninstall --global ltcf-prompt-compression
```

Use `--no-codex` with `install` or `uninstall` for another harness. The lifecycle state lives in `LTCF_HOME` when set, otherwise in `~/.ltcf`. Codex currently exposes marketplace registration through its CLI; install the offered LTCF plugin from Codex's plugin surface to activate its learning hook. Prompt replacement works through `ltcf run` and is harness-agnostic.

For a source checkout:

```bash
npm install
npm test
```

The repository includes the `o200k_base` rank file used by the tokenizer. Its checksum is validated at runtime.

## CLI

Build:

```bash
npm run build
```

Transform stdin:

```bash
cat prompt.txt | node dist/src/cli.js transform --metrics > optimized.txt
```

After package installation/linking:

```bash
cat prompt.txt | ltcf transform --metrics > optimized.txt
```

Run any stdin-based harness with replacement enabled:

```bash
cat prompt.txt | ltcf run -- my-harness --headless
```

For argument-based harnesses:

```bash
cat prompt.txt | ltcf run --argument -- my-harness --prompt "{prompt}"
```

`{prompt}` is replaced with the selected model prompt. If no placeholder is present, LTCF appends the prompt as the final argument.

## Codex

For non-interactive Codex, the current `codex exec` implementation supports reading the prompt from stdin when no positional prompt is supplied (or when `-` is used). That makes the pre-harness replacement path straightforward:

```bash
cat prompt.txt | ltcf run -- codex exec -
```

### Why the Codex hook does not replace the prompt

The current Codex `UserPromptSubmit` hook receives the original `prompt`, but its output path exposes blocking and `additionalContext`; it does **not** expose a replacement-prompt field. Therefore using the hook to append a compressed copy would increase context rather than reduce it.

LTCF's Codex hook is intentionally **learning-only**:

```text
UserPromptSubmit
      │
      └── observe repeated patterns locally
            └── update versioned shared dictionary

actual prompt replacement
      └── LTCF preprocessor / process wrapper
```

The Codex plugin manifest and hook are under:

```text
.codex-plugin/plugin.json
hooks/hooks.json
skills/ltcf-prompt-compression/SKILL.md
```

The hook stores its state under Codex's `PLUGIN_DATA` directory when provided. To keep submit latency bounded, the Codex adapter waits for 4 samples before its first training pass, retains at most 16 samples of 4,000 characters, retrains every 12 observations, and caps the learned base at 16 aliases.

See [docs/CODEX.md](docs/CODEX.md).

## Any harness

The smallest integration surface is a callback:

```ts
import { invokeWithCompression } from "ltcf-prompt-compression";

await invokeWithCompression(prompt, async (optimizedPrompt) => {
  // Codex, Claude Code, Gemini CLI, a custom agent, an SDK, a queue, etc.
  return harness.invoke(optimizedPrompt);
});
```

Built-in adapters:

```text
src/adapters/generic.ts            arbitrary callback/sink
src/adapters/process.ts            stdin or process argument
src/adapters/openai-compatible.ts  request JSON transformer
```

The OpenAI-compatible adapter is pure; it rewrites user text and returns a cloned request object without sending anything over the network.

## Shared dictionaries

A fixed index is not optimal for every request. LTCF uses two levels:

```text
persistent shared dictionary
          +
per-request delta dictionary
```

Train a shared dictionary:

```bash
ltcf train --id my-project --output project.dictionary.json -- docs/*.txt logs/*.txt
```

Render the bootstrap that a persistent session must know:

```bash
ltcf bootstrap --dictionary project.dictionary.json
```

Transform a later request assuming that exact dictionary version is already available in the model session/runtime:

```bash
cat request.txt | ltcf transform \
  --dictionary project.dictionary.json \
  --session \
  --metrics
```

The request contains only a short dictionary reference, the request-specific delta and the encoded body.

### Shared-dictionary accounting caveat

A dictionary is not magically free. If its bootstrap is part of every model input, its tokens still count toward the context window. It is most useful when one of these is true:

1. the harness/session already retains the bootstrap and the relevant cost is amortized;
2. provider prompt caching makes the stable bootstrap cheaper to reuse;
3. the dictionary lives in a decoder/runtime outside the prompt;
4. the same dictionary is reused across enough requests to justify its one-time cost.

For strict context-window accounting, include the bootstrap tokens when comparing alternatives.

## Adaptive learning

The optional learning state keeps a bounded local sample window and retrains periodically:

```text
max observations:       24
max chars / observation: 8,000
retrain interval:       12 observations
shared aliases:         up to 24 by default
per-request alias pool: up to 64 total
```

Manual observation and dictionary export:

```bash
cat prompt.txt | ltcf observe --state .ltcf/state.json
ltcf export --state .ltcf/state.json --output project.dictionary.json
```

Privacy note: adaptive learning stores bounded raw prompt samples locally. Do not enable it for sensitive prompts unless that local persistence is acceptable.

## OpenAI-compatible request transformation

```ts
import { transformOpenAICompatibleRequest } from "ltcf-prompt-compression/adapters/openai-compatible";

const { body, transforms } = transformOpenAICompatibleRequest({
  model: "example-model",
  messages: [
    { role: "system", content: "You are a coding agent." },
    { role: "user", content: hugeRepeatedPrompt },
  ],
});

// send `body` using your existing client
```

Only user text is transformed.

## Algorithm

1. tokenize the original text;
2. enumerate repeated token n-grams;
3. reject candidates that cannot theoretically pay for themselves;
4. rank candidates by estimated saving;
5. test the strongest candidates against the **fully rendered** payload;
6. accept only the candidate with positive exact marginal saving;
7. repeat until no candidate helps or the alias budget is exhausted;
8. compare the complete compressed prompt against the original;
9. return the original unchanged if compression loses.

For a repeated sequence with token cost `L`, frequency `f`, alias cost `a`, and dictionary-line cost `d`, the first-order condition is:

```text
saving ≈ f × (L - a) - d
```

The final decision never relies on this approximation; it re-tokenizes the actual payload.

## Tokenizer scope

Version `0.1.x` optimizes against `o200k_base`. The **harness layer is agnostic**, but exact savings are tokenizer/model-specific. A future codec interface can add Claude, Gemini, Llama/Qwen and other tokenizers without changing the harness adapters.

Using the current codec against another model is still lossless, but the reported token savings are only an `o200k_base` proxy.

## Prompt caching

Dynamic compression and prompt caching can pull in opposite directions: a changing prefix can reduce cache reuse. Keep stable system/developer context and shared dictionaries stable, and place request-specific delta content later when the target provider benefits from prefix caching.

A production optimizer should ultimately minimize **effective cost**, not raw token count alone.

## Project layout

```text
src/compressor.ts                  adaptive MDL-style dictionary optimizer
src/optimizer.ts                   balanced/aggressive search profiles
src/tokenizer.ts                   o200k_base codec
src/shared.ts                      versioned persistent dictionaries
src/state.ts                       bounded adaptive learning
src/transform.ts                   standalone/shared transform decision
src/adapters/generic.ts            harness-neutral callback adapter
src/adapters/process.ts            generic CLI/process transport
src/adapters/openai-compatible.ts  API request transformation
src/hook-codex.ts                  Codex learning hook
hooks/hooks.json                   Codex hook declaration
.codex-plugin/plugin.json          Codex plugin manifest
```

## Validation

Current local suite:

```text
16 tests
16 passed
0 failed
```

It covers tokenizer reference vectors, arbitrary UTF-8 round-trip, serialization, adaptive stopping, alias constraints, generic callback replacement, process/stdin replacement, OpenAI-compatible transformation, shared-session decoding and the Codex learning hook.

## Limitations

- Greedy selection is an approximation to the global optimum when patterns overlap.
- The model must correctly interpret the LTCF expansion convention; local decoding being lossless does not guarantee model exact-match behavior.
- The current optimizer targets `o200k_base` only.
- Highly novel, already compact or very short prompts may not compress; LTCF then sends the original.
- Shared dictionaries must be version-synchronized between encoder and decoder/session.

## References

- OpenAI tiktoken: https://github.com/openai/tiktoken
- Codex source: https://github.com/openai/codex
- Codex plugin manifest sample/spec: https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/plugin-creator/references/plugin-json-spec.md
- Codex UserPromptSubmit implementation: https://github.com/openai/codex/blob/main/codex-rs/hooks/src/events/user_prompt_submit.rs
- Campos et al., *Lossless Prompt Compression via Dictionary-Encoding and In-Context Learning* (2026): https://arxiv.org/abs/2604.13066

## License

MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
