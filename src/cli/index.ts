#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { CloneCommand } from "../core/clone.js";
import { ListCommand } from "../core/list.js";

function resolvePackageRoot(fromDir: string): string {
  let dir = fromDir;
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

function failWithError(error: unknown): never {
  if (error instanceof Error) {
    process.stderr.write(`error: ${error.message}\n`);
    process.exit(1);
  }
  throw error;
}

program
  .command("clone <repo> [name]")
  .description("Create a bare clone of a repository")
  .action(async (repo: string, name?: string) => {
    try {
      const cmd = new CloneCommand();
      const bareDir = await cmd.execute(
        name === undefined ? { repo } : { repo, name },
      );
      process.stdout.write(`Cloned into ${bareDir}\n`);
      process.stdout.write("To get started, move into the project:\n");
      process.stdout.write(`  cd ${bareDir}\n`);
      process.stdout.write("Then add your first worktree:\n");
      process.stdout.write("  bwt add <branch>\n");
    } catch (error) {
      failWithError(error);
    }
  });

program
  .command("list")
  .description("List all active worktrees")
  .action(async () => {
    try {
      const cmd = new ListCommand();
      await cmd.execute(process.cwd());
    } catch (error) {
      failWithError(error);
    }
  });

export function run(argv = process.argv): void {
  program.parse(argv);
}

run();
