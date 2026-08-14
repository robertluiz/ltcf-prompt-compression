---
name: ltcf
description: Compress large repetitive prompts losslessly before invoking a model or agent harness. Use when token cost/context size matters, or when benchmarking LTCF prompt compression.
---

# LTCF Prompt Compression

Use the project CLI rather than reproducing compression manually.

## Rules

1. Prefer `ltcf transform` for a self-contained request.
2. Prefer a trained shared dictionary for repeated project/session traffic.
3. Never send both the original and compressed prompt when measuring token savings.
4. If compression has no positive net token saving, send the original unchanged.
5. Treat Codex `UserPromptSubmit` hooks as learning-only: current hooks can inject `additionalContext` or block but do not expose prompt replacement. Use the wrapper/preprocessor for actual replacement.

## Examples

```bash
cat prompt.txt | ltcf transform --metrics
```

```bash
ltcf train --output project.dictionary.json -- docs/*.txt
ltcf bootstrap --dictionary project.dictionary.json
cat prompt.txt | ltcf transform --dictionary project.dictionary.json --session --metrics
```

For Codex headless execution, pass only the transformed prompt through stdin:

```bash
cat prompt.txt | ltcf run -- codex exec
```
