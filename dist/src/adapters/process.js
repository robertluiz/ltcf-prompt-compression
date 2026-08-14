import { spawn } from "node:child_process";
import { invokeWithCompression } from "./generic.js";
/**
 * Generic harness adapter. It never forwards the original prompt when
 * compression is selected: only transform.prompt is delivered to the child.
 */
export async function runHarness(originalPrompt, options) {
    const invocation = await invokeWithCompression(originalPrompt, async (modelPrompt) => {
        const transport = options.transport ?? "stdin";
        let args = [...(options.args ?? [])];
        if (transport === "argument") {
            const placeholder = options.placeholder ?? "{prompt}";
            let replaced = false;
            args = args.map((arg) => {
                if (!arg.includes(placeholder))
                    return arg;
                replaced = true;
                return arg.replaceAll(placeholder, modelPrompt);
            });
            if (!replaced)
                args.push(modelPrompt);
        }
        const child = spawn(options.command, args, {
            cwd: options.cwd,
            env: options.env ?? process.env,
            stdio: transport === "stdin" ? ["pipe", "inherit", "inherit"] : ["inherit", "inherit", "inherit"],
        });
        if (transport === "stdin")
            child.stdin.end(modelPrompt);
        return await new Promise((resolve, reject) => {
            child.once("error", reject);
            child.once("exit", (code) => resolve(code ?? 1));
        });
    }, options);
    return { transform: invocation.transform, exitCode: invocation.response };
}
//# sourceMappingURL=process.js.map