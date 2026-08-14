import { compress, metrics } from "./compressor.js";
import { DECODER_CONTRACT, renderPayload } from "./format.js";
export async function testExactReconstruction(original, model = process.env.OPENAI_MODEL ?? "gpt-5") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
        throw new Error("Set OPENAI_API_KEY before running llm-test.");
    const document = compress(original);
    const compressionMetrics = metrics(document);
    const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            instructions: [
                DECODER_CONTRACT,
                "Reconstruct the B section exactly.",
                "Return only the reconstructed text between <ORIGINAL> and </ORIGINAL>.",
                "Do not use Markdown code fences and do not add commentary.",
            ].join(" "),
            input: renderPayload(document),
            max_output_tokens: Math.max(1_024, Math.ceil(document.originalTokens * 1.25) + 128),
            store: false,
        }),
    });
    const payload = (await response.json());
    if (!response.ok) {
        const message = typeof payload.error?.message === "string"
            ? payload.error.message
            : `${response.status} ${response.statusText}`;
        throw new Error(`OpenAI Responses API failed: ${message}`);
    }
    const output = extractOriginal(extractResponseText(payload));
    return {
        model,
        exactMatch: output === original,
        originalTokens: compressionMetrics.originalTokens,
        compressedPromptTokens: compressionMetrics.promptWithDecoderTokens,
        output,
    };
}
function extractResponseText(response) {
    if (typeof response.output_text === "string")
        return response.output_text;
    if (!Array.isArray(response.output))
        return "";
    const texts = [];
    for (const item of response.output) {
        if (!Array.isArray(item.content))
            continue;
        for (const content of item.content) {
            if (content.type === "output_text" && typeof content.text === "string") {
                texts.push(content.text);
            }
        }
    }
    return texts.join("");
}
function extractOriginal(text) {
    const startTag = "<ORIGINAL>";
    const endTag = "</ORIGINAL>";
    const start = text.indexOf(startTag);
    const end = text.lastIndexOf(endTag);
    if (start === -1 || end === -1 || end < start)
        return text;
    return text.slice(start + startTag.length, end);
}
//# sourceMappingURL=llm-test.js.map