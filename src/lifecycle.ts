import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const CONFIG_FORMAT = "LTCF-CONFIG/1";
const MARKETPLACE_NAME = "ltcf-prompt-compression";
const MARKETPLACE_SOURCE = "robertluiz/ltcf-prompt-compression";

interface LifecycleConfig {
  format: typeof CONFIG_FORMAT;
  installed: boolean;
  enabled: boolean;
  codexMarketplace: boolean;
}

export interface LifecycleStatus {
  installed: boolean;
  enabled: boolean;
  codexMarketplace: boolean;
  home: string;
}

export interface CodexMarketplace {
  add(): void;
  remove(): void;
}

export interface LifecycleOptions {
  home?: string;
  marketplace?: CodexMarketplace;
  skipCodex?: boolean;
  purge?: boolean;
}

export function installLifecycle(options: LifecycleOptions = {}): LifecycleStatus {
  const home = lifecycleHome(options.home);
  const current = readConfig(home);
  let codexMarketplace = current.codexMarketplace;
  if (!options.skipCodex && !codexMarketplace) {
    (options.marketplace ?? createCodexMarketplace()).add();
    codexMarketplace = true;
  }
  writeConfig(home, { ...current, installed: true, enabled: true, codexMarketplace });
  return lifecycleStatus({ home });
}

export function enableLifecycle(options: LifecycleOptions = {}): LifecycleStatus {
  return updateLifecycle(options.home, (current) => ({ ...current, enabled: true }));
}

export function disableLifecycle(options: LifecycleOptions = {}): LifecycleStatus {
  return updateLifecycle(options.home, (current) => ({ ...current, enabled: false }));
}

export function uninstallLifecycle(options: LifecycleOptions = {}): LifecycleStatus {
  const home = lifecycleHome(options.home);
  const current = readConfig(home);
  let codexMarketplace = current.codexMarketplace;
  if (!options.skipCodex && current.codexMarketplace) {
    (options.marketplace ?? createCodexMarketplace()).remove();
    codexMarketplace = false;
  }
  if (options.purge) purgeKnownData(home);
  writeConfig(home, { ...current, installed: false, enabled: false, codexMarketplace });
  return lifecycleStatus({ home });
}

export function lifecycleStatus(options: Pick<LifecycleOptions, "home"> = {}): LifecycleStatus {
  const home = lifecycleHome(options.home);
  const config = readConfig(home);
  return {
    installed: config.installed,
    enabled: config.enabled,
    codexMarketplace: config.codexMarketplace,
    home,
  };
}

export function isLifecycleEnabled(options: Pick<LifecycleOptions, "home"> = {}): boolean {
  return lifecycleStatus(options).enabled;
}

export function formatLifecycleStatus(status: LifecycleStatus): string {
  return [
    `LTCF: ${status.enabled ? "enabled" : "disabled"}`,
    `Setup: ${status.installed ? "installed" : "not installed"}`,
    `Codex marketplace: ${status.codexMarketplace ? "registered" : "not registered"}`,
    `Home: ${status.home}`,
  ].join("\n") + "\n";
}

function lifecycleHome(home?: string): string {
  return resolve(home ?? process.env.LTCF_HOME ?? join(homedir(), ".ltcf"));
}

function updateLifecycle(
  home: string | undefined,
  update: (current: LifecycleConfig) => LifecycleConfig,
): LifecycleStatus {
  const resolvedHome = lifecycleHome(home);
  writeConfig(resolvedHome, update(readConfig(resolvedHome)));
  return lifecycleStatus({ home: resolvedHome });
}

function readConfig(home: string): LifecycleConfig {
  const path = configPath(home);
  if (!existsSync(path)) return defaultConfig();
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<LifecycleConfig>;
  if (parsed.format !== CONFIG_FORMAT) throw new Error(`Unsupported LTCF config format in ${path}`);
  return {
    format: CONFIG_FORMAT,
    installed: parsed.installed === true,
    enabled: parsed.enabled !== false,
    codexMarketplace: parsed.codexMarketplace === true,
  };
}

function writeConfig(home: string, config: LifecycleConfig): void {
  const path = configPath(home);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, JSON.stringify(config, null, 2) + "\n", "utf8");
  renameSync(temporary, path);
}

function defaultConfig(): LifecycleConfig {
  return { format: CONFIG_FORMAT, installed: false, enabled: true, codexMarketplace: false };
}

function configPath(home: string): string {
  return join(home, "config.json");
}

function purgeKnownData(home: string): void {
  for (const name of ["state.json", "ltcf.dictionary.json"]) {
    rmSync(join(home, name), { force: true });
  }
  rmSync(join(home, "data"), { recursive: true, force: true });
}

function createCodexMarketplace(): CodexMarketplace {
  return {
    add: () => runCodex(["plugin", "marketplace", "add", MARKETPLACE_SOURCE]),
    remove: () => runCodex(["plugin", "marketplace", "remove", MARKETPLACE_NAME]),
  };
}

function runCodex(args: string[]): void {
  const executable = process.platform === "win32" ? "codex.cmd" : "codex";
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status === 0) return;
  const detail = String(result.stderr || result.stdout || `exit code ${result.status}`).trim();
  throw new Error(`Codex marketplace command failed: ${detail}`);
}
