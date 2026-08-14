import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { disableLifecycle, enableLifecycle, installLifecycle, isLifecycleEnabled, lifecycleStatus, uninstallLifecycle, } from "../src/lifecycle.js";
function fakeMarketplace(calls) {
    return {
        add: () => calls.push("add"),
        remove: () => calls.push("remove"),
    };
}
test("install is idempotent and enables LTCF", () => {
    const home = mkdtempSync(join(tmpdir(), "ltcf-lifecycle-"));
    const calls = [];
    const marketplace = fakeMarketplace(calls);
    installLifecycle({ home, marketplace });
    installLifecycle({ home, marketplace });
    assert.deepEqual(calls, ["add"]);
    assert.deepEqual(lifecycleStatus({ home }), {
        installed: true,
        enabled: true,
        codexMarketplace: true,
        home,
    });
});
test("enable and disable preserve installation state", () => {
    const home = mkdtempSync(join(tmpdir(), "ltcf-lifecycle-"));
    installLifecycle({ home, skipCodex: true });
    disableLifecycle({ home });
    assert.equal(isLifecycleEnabled({ home }), false);
    assert.equal(lifecycleStatus({ home }).installed, true);
    enableLifecycle({ home });
    assert.equal(isLifecycleEnabled({ home }), true);
});
test("uninstall disables LTCF and preserves data by default", () => {
    const home = mkdtempSync(join(tmpdir(), "ltcf-lifecycle-"));
    const dataPath = join(home, "state.json");
    const calls = [];
    const marketplace = fakeMarketplace(calls);
    installLifecycle({ home, marketplace });
    writeFileSync(dataPath, "saved-learning", "utf8");
    uninstallLifecycle({ home, marketplace });
    assert.deepEqual(calls, ["add", "remove"]);
    assert.equal(existsSync(dataPath), true);
    assert.equal(lifecycleStatus({ home }).installed, false);
    assert.equal(isLifecycleEnabled({ home }), false);
});
test("uninstall with no-codex preserves marketplace tracking", () => {
    const home = mkdtempSync(join(tmpdir(), "ltcf-lifecycle-"));
    const calls = [];
    const marketplace = fakeMarketplace(calls);
    installLifecycle({ home, marketplace });
    uninstallLifecycle({ home, marketplace, skipCodex: true });
    assert.deepEqual(calls, ["add"]);
    assert.equal(lifecycleStatus({ home }).codexMarketplace, true);
});
test("purge removes LTCF data but keeps disabled tombstone", () => {
    const home = mkdtempSync(join(tmpdir(), "ltcf-lifecycle-"));
    const dataPath = join(home, "state.json");
    installLifecycle({ home, skipCodex: true });
    writeFileSync(dataPath, "saved-learning", "utf8");
    uninstallLifecycle({ home, skipCodex: true, purge: true });
    assert.equal(existsSync(dataPath), false);
    assert.equal(lifecycleStatus({ home }).installed, false);
    assert.equal(isLifecycleEnabled({ home }), false);
});
test("missing config preserves legacy enabled behavior", () => {
    const home = join(mkdtempSync(join(tmpdir(), "ltcf-lifecycle-")), "missing");
    assert.equal(isLifecycleEnabled({ home }), true);
});
//# sourceMappingURL=lifecycle.test.js.map