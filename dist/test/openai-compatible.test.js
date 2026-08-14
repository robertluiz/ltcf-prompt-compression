import test from "node:test";
import assert from "node:assert/strict";
import { transformOpenAICompatibleRequest } from "../src/adapters/openai-compatible.js";
test("OpenAI-compatible adapter rewrites only user text", () => {
    const repeated = Array.from({ length: 20 }, () => "service=orders status=success duration_ms=17").join("\n");
    const request = {
        model: "example",
        messages: [
            { role: "system", content: "System stays unchanged." },
            { role: "user", content: repeated },
        ],
    };
    const transformed = transformOpenAICompatibleRequest(request);
    const messages = transformed.body.messages;
    assert.equal(messages[0]?.content, "System stays unchanged.");
    assert.notEqual(messages[1]?.content, repeated);
    assert.equal(transformed.transforms[0]?.decodeLocal(), repeated);
});
//# sourceMappingURL=openai-compatible.test.js.map