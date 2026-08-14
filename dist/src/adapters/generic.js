import { transformPrompt } from "../transform.js";
/**
 * Smallest possible harness integration contract.
 *
 * The callback receives exactly one prompt: the selected model input. When
 * compression wins, that value is the compressed prompt; the original is never
 * passed to the harness callback.
 */
export async function invokeWithCompression(originalPrompt, send, options = {}) {
    const transform = transformPrompt(originalPrompt, options);
    const response = await send(transform.prompt, transform);
    return { transform, response };
}
//# sourceMappingURL=generic.js.map