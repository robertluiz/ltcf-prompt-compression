import type { EncodingName } from "./types.js";
export declare class TokenCodec {
    readonly name: EncodingName;
    private readonly data;
    constructor(name?: EncodingName);
    encode(text: string): number[];
    decode(tokens: readonly number[]): string;
    /** Returns null when the token slice starts or ends inside a UTF-8 character. */
    decodeStrict(tokens: readonly number[]): string | null;
    count(text: string): number;
    private tokenBytes;
}
