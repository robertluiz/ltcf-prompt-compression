import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { EncodingName } from "./types.js";

interface EncodingData {
  ranks: Map<string, number>;
  inverseRanks: Map<number, Buffer>;
}

const encodingCache = new Map<EncodingName, EncodingData>();
const O200K_BASE_SHA256 =
  "446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d";
const utf8FatalDecoder = new TextDecoder("utf-8", { fatal: true });

const CONTRACTION =
  "(?:'[sS]|'[tT]|'[rR][eE]|'[vV][eE]|'[mM]|'[lL][lL]|'[dD])?";

// JavaScript-compatible form of the official o200k_base pre-tokenization regex.
// Python's scoped (?i:...) flag is expanded manually in CONTRACTION.
const O200K_PATTERN = [
  `[^\\r\\n\\p{L}\\p{N}]?[\\p{Lu}\\p{Lt}\\p{Lm}\\p{Lo}\\p{M}]*[\\p{Ll}\\p{Lm}\\p{Lo}\\p{M}]+${CONTRACTION}`,
  `[^\\r\\n\\p{L}\\p{N}]?[\\p{Lu}\\p{Lt}\\p{Lm}\\p{Lo}\\p{M}]+[\\p{Ll}\\p{Lm}\\p{Lo}\\p{M}]*${CONTRACTION}`,
  "\\p{N}{1,3}",
  " ?[^\\s\\p{L}\\p{N}]+[\\r\\n/]*",
  "\\s*[\\r\\n]+",
  "\\s+(?!\\S)",
  "\\s+",
].join("|");

export class TokenCodec {
  private readonly data: EncodingData;

  constructor(public readonly name: EncodingName = "o200k_base") {
    this.data = loadEncoding(name);
  }

  encode(text: string): number[] {
    if (text.length === 0) return [];

    const result: number[] = [];
    const pattern = new RegExp(O200K_PATTERN, "gu");
    let consumedUtf16Units = 0;

    for (const match of text.matchAll(pattern)) {
      const pieceText = match[0];
      const matchIndex = match.index;
      if (matchIndex !== consumedUtf16Units) {
        throw new Error(
          `Tokenizer regex left unmatched text at UTF-16 offset ${consumedUtf16Units}.`,
        );
      }
      consumedUtf16Units = matchIndex + pieceText.length;

      const piece = Buffer.from(pieceText, "utf8");
      const direct = this.data.ranks.get(bytesKey(piece));
      if (direct !== undefined) {
        result.push(direct);
      } else {
        result.push(...bytePairEncode(piece, this.data.ranks));
      }
    }

    if (consumedUtf16Units !== text.length) {
      throw new Error(
        `Tokenizer regex consumed ${consumedUtf16Units} of ${text.length} UTF-16 units.`,
      );
    }

    return result;
  }

  decode(tokens: readonly number[]): string {
    return Buffer.concat(tokens.map((token) => this.tokenBytes(token))).toString("utf8");
  }

  /** Returns null when the token slice starts or ends inside a UTF-8 character. */
  decodeStrict(tokens: readonly number[]): string | null {
    try {
      const bytes = Buffer.concat(tokens.map((token) => this.tokenBytes(token)));
      return utf8FatalDecoder.decode(bytes);
    } catch {
      return null;
    }
  }

  count(text: string): number {
    return this.encode(text).length;
  }

  private tokenBytes(token: number): Buffer {
    const bytes = this.data.inverseRanks.get(token);
    if (!bytes) throw new Error(`Unknown ${this.name} token id: ${token}`);
    return bytes;
  }
}

function loadEncoding(name: EncodingName): EncodingData {
  const cached = encodingCache.get(name);
  if (cached) return cached;

  if (name !== "o200k_base") {
    throw new Error(`Unsupported tokenizer encoding: ${name}`);
  }

  const source = readEncodingFile(name);
  const sourceHash = createHash("sha256").update(source, "utf8").digest("hex");
  if (sourceHash !== O200K_BASE_SHA256) {
    throw new Error(
      `Unexpected ${name} SHA-256: ${sourceHash}; expected ${O200K_BASE_SHA256}.`,
    );
  }
  const ranks = new Map<string, number>();
  const inverseRanks = new Map<number, Buffer>();

  for (const line of source.split("\n")) {
    if (line.length === 0) continue;
    const separator = line.lastIndexOf(" ");
    if (separator <= 0) throw new Error(`Invalid tokenizer rank line: ${line}`);

    const tokenBytes = Buffer.from(line.slice(0, separator), "base64");
    const rank = Number.parseInt(line.slice(separator + 1), 10);
    if (!Number.isSafeInteger(rank)) {
      throw new Error(`Invalid tokenizer rank: ${line}`);
    }
    ranks.set(bytesKey(tokenBytes), rank);
    inverseRanks.set(rank, tokenBytes);
  }

  if (ranks.size !== 199_998) {
    throw new Error(
      `Unexpected o200k_base vocabulary size: ${ranks.size}; expected 199998.`,
    );
  }

  const data = { ranks, inverseRanks };
  encodingCache.set(name, data);
  return data;
}

function readEncodingFile(name: EncodingName): string {
  const filename = `${name}.tiktoken`;
  const modulePath = fileURLToPath(import.meta.url);
  const candidates = [
    process.env.TIKTOKEN_BPE_FILE,
    resolve(process.cwd(), "assets", filename),
    resolve(modulePath, "..", "..", "..", "assets", filename), // dist/src/*.js
    resolve(modulePath, "..", "..", "assets", filename), // src/*.ts via a TS runner
  ].filter((value): value is string => Boolean(value));

  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) {
    throw new Error(
      `Cannot find ${filename}. Tried: ${candidates.join(", ")}. ` +
        "Set TIKTOKEN_BPE_FILE to override the path.",
    );
  }
  return readFileSync(path, "utf8");
}

function bytePairEncode(piece: Uint8Array, ranks: Map<string, number>): number[] {
  if (piece.length === 0) return [];
  if (piece.length === 1) {
    const rank = ranks.get(bytesKey(piece));
    if (rank === undefined) throw new Error("Missing single-byte tokenizer rank.");
    return [rank];
  }

  const parts: Array<{ start: number; end: number }> = Array.from(
    { length: piece.length },
    (_, index) => ({ start: index, end: index + 1 }),
  );

  while (parts.length > 1) {
    let bestRank = Number.POSITIVE_INFINITY;
    let bestIndex = -1;

    for (let index = 0; index < parts.length - 1; index += 1) {
      const left = parts[index];
      const right = parts[index + 1];
      if (!left || !right) continue;
      const rank = ranks.get(bytesKey(piece.subarray(left.start, right.end)));
      if (rank !== undefined && rank < bestRank) {
        bestRank = rank;
        bestIndex = index;
      }
    }

    if (bestIndex === -1) break;
    const left = parts[bestIndex];
    const right = parts[bestIndex + 1];
    if (!left || !right) throw new Error("Invalid BPE merge state.");
    parts[bestIndex] = { start: left.start, end: right.end };
    parts.splice(bestIndex + 1, 1);
  }

  return parts.map(({ start, end }) => {
    const rank = ranks.get(bytesKey(piece.subarray(start, end)));
    if (rank === undefined) throw new Error("Tokenizer produced an unknown byte piece.");
    return rank;
  });
}

function bytesKey(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1");
}
