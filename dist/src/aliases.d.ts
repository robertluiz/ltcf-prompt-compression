import { TokenCodec } from "./tokenizer.js";
/**
 * Ordered alias alphabet for o200k_base. The first 64 symbols form the balanced
 * six-bit logical index. Every selected alias is verified as a one-token string
 * at runtime and skipped when it already occurs in the source.
 */
export declare const BALANCED_ALIAS_SYMBOLS: readonly ["¤", "¦", "§", "¨", "¯", "±", "¶", "·", "¸", "×", "÷", "˚", "˜", "˝", "‐", "‑", "―", "․", "‰", "′", "″", "※", "‼", "℃", "№", "∀", "∆", "−", "∙", "√", "∞", "∨", "≈", "≤", "≥", "≫", "─", "━", "│", "┃", "├", "┣", "═", "║", "▀", "▄", "▋", "░", "▒", "▓", "■", "□", "▪", "▫", "▬", "▲", "△", "▶", "▷", "►", "▼", "▽", "◆", "◇", "○", "◎", "●", "★", "☆"];
export interface AliasIndexEntry {
    logicalIndex: number;
    symbol: string;
    tokenId: number;
    tokenCost: number;
}
export declare function buildAliasIndex(codec: TokenCodec, count?: number): AliasIndexEntry[];
/**
 * Finds printable aliases absent from the source. Unused aliases never appear
 * in the prompt, so a large candidate pool has zero token overhead by itself.
 */
export declare function generateAliases(codec: TokenCodec, source: string, count: number): string[];
