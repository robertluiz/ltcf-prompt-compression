import { TokenCodec } from "./tokenizer.js";

/**
 * Ordered alias alphabet for o200k_base. The first 64 symbols form the balanced
 * six-bit logical index. Every selected alias is verified as a one-token string
 * at runtime and skipped when it already occurs in the source.
 */
export const BALANCED_ALIAS_SYMBOLS = [
  "¤", "¦", "§", "¨", "¯", "±", "¶", "·", "¸", "×", "÷", "˚", "˜", "˝",
  "‐", "‑", "―", "․", "‰", "′", "″", "※", "‼", "℃", "№", "∀", "∆", "−",
  "∙", "√", "∞", "∨", "≈", "≤", "≥", "≫", "─", "━", "│", "┃", "├", "┣",
  "═", "║", "▀", "▄", "▋", "░", "▒", "▓", "■", "□", "▪", "▫", "▬", "▲",
  "△", "▶", "▷", "►", "▼", "▽", "◆", "◇", "○", "◎", "●", "★", "☆",
] as const;

export interface AliasIndexEntry {
  logicalIndex: number;
  symbol: string;
  tokenId: number;
  tokenCost: number;
}

export function buildAliasIndex(
  codec: TokenCodec,
  count = 64,
): AliasIndexEntry[] {
  return generateAliases(codec, "", count).map((symbol, logicalIndex) => ({
    logicalIndex,
    symbol,
    tokenId: codec.encode(symbol)[0] ?? -1,
    tokenCost: codec.count(symbol),
  }));
}

/**
 * Finds printable aliases absent from the source. Unused aliases never appear
 * in the prompt, so a large candidate pool has zero token overhead by itself.
 */
export function generateAliases(
  codec: TokenCodec,
  source: string,
  count: number,
): string[] {
  const aliases: string[] = [];

  for (const candidate of BALANCED_ALIAS_SYMBOLS) {
    if (source.includes(candidate)) continue;
    if (codec.count(candidate) !== 1) continue;
    aliases.push(candidate);
    if (aliases.length >= count) return aliases;
  }

  // Aggressive fallback: printable CJK code points that are one o200k token.
  // These are only used after the curated symbol alphabet is exhausted.
  for (let codePoint = 0x3400; codePoint <= 0x9fff; codePoint += 1) {
    const candidate = String.fromCodePoint(codePoint);
    if (source.includes(candidate)) continue;
    if (codec.count(candidate) !== 1) continue;
    aliases.push(candidate);
    if (aliases.length >= count) return aliases;
  }

  // Safe final fallback. It may cost multiple tokens, and exact MDL evaluation
  // will reject entries whose replacement no longer has a positive net gain.
  for (let index = 0; aliases.length < count; index += 1) {
    const candidate = `⟦${index.toString(36)}⟧`;
    if (!source.includes(candidate)) aliases.push(candidate);
  }

  return aliases;
}
