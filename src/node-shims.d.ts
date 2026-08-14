declare const process: any;
declare const Buffer: any;
type Buffer = any;
declare namespace NodeJS { interface ProcessEnv { [key: string]: string | undefined } }

declare module "node:buffer" { export const Buffer: any; }
declare module "node:crypto" { export function createHash(...args: any[]): any; }
declare module "node:fs" {
  export function existsSync(...args: any[]): any;
  export function readFileSync(...args: any[]): any;
  export function writeFileSync(...args: any[]): any;
  export function mkdirSync(...args: any[]): any;
  export function renameSync(...args: any[]): any;
  export function mkdtempSync(...args: any[]): any;
}
declare module "node:path" {
  export function resolve(...args: any[]): string;
  export function dirname(...args: any[]): string;
  export function join(...args: any[]): string;
}
declare module "node:url" { export function fileURLToPath(...args: any[]): string; }
declare module "node:os" { export function tmpdir(): string; }
declare module "node:child_process" {
  export function spawn(...args: any[]): any;
}
declare module "node:test" { const test: any; export default test; }
declare module "node:assert/strict" { const assert: any; export default assert; }
