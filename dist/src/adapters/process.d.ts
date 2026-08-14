import { type TransformOptions, type PromptTransformResult } from "../transform.js";
export interface ProcessAdapterOptions extends TransformOptions {
    command: string;
    args?: string[];
    transport?: "stdin" | "argument";
    placeholder?: string;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
}
export interface ProcessRunResult {
    transform: PromptTransformResult;
    exitCode: number;
}
/**
 * Generic harness adapter. It never forwards the original prompt when
 * compression is selected: only transform.prompt is delivered to the child.
 */
export declare function runHarness(originalPrompt: string, options: ProcessAdapterOptions): Promise<ProcessRunResult>;
