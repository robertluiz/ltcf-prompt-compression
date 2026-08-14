export interface LlmTestResult {
    model: string;
    exactMatch: boolean;
    originalTokens: number;
    compressedPromptTokens: number;
    output: string;
}
export declare function testExactReconstruction(original: string, model?: any): Promise<LlmTestResult>;
