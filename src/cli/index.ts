#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

function resolvePackageRoot(fromDir: string): string {
  let dir = fromDir;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      readFileSync(join(dir, "package.json"), "utf-8");
      return dir;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) {
        throw new Error(`package.json not found from ${fromDir}`);
      }
      dir = parent;
    }
  }
}

const root = resolvePackageRoot(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8")) as {
  version: string;
};

const program = new Command();

program
  .name("bwt")
  .description("CLI for git worktrees using the bare clone pattern")
  .version(pkg.version);

function _failWithError(error: unknown): never {
  if (error instanceof Error) {
    process.stderr.write(`error: ${error.message}\n`);
    process.exit(1);
  }
  throw error;
}

export function run(argv = process.argv): void {
  program.parse(argv);
}

if (
  process.argv[1] &&
  new URL(process.argv[1], "file://").pathname ===
    new URL(import.meta.url).pathname
) {
  program.parse();
}
