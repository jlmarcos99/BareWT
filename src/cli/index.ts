#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { AddCommand } from "../core/add.js";
import { CloneCommand } from "../core/clone.js";
import { ListCommand } from "../core/list.js";
import { PruneCommand } from "../core/prune.js";
import { RemoveCommand } from "../core/remove.js";
import { WipeCommand } from "../core/wipe.js";

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
  .alias("c")
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
  .command("add <branch>")
  .alias("a")
  .description("Add a worktree for a branch")
  .option("--new", "Create a new branch before adding the worktree")
  .action(async (branch: string, options: { new?: boolean }) => {
    try {
      const cmd = new AddCommand();
      const opts: { branch: string; new?: boolean } = { branch };
      if (options.new) opts.new = true;
      const path = await cmd.execute(process.cwd(), opts);
      const relPath = relative(process.cwd(), path);
      process.stdout.write(`Added worktree at ${relPath}\n`);
      process.stdout.write(`To start working: cd ${relPath}\n`);
    } catch (error) {
      failWithError(error);
    }
  });

program
  .command("list")
  .alias("l")
  .description("List all active worktrees")
  .action(async () => {
    try {
      const cmd = new ListCommand();
      await cmd.execute(process.cwd());
    } catch (error) {
      failWithError(error);
    }
  });

program
  .command("remove <branch>")
  .alias("r")
  .description("Remove a worktree (does not delete the branch)")
  .option("--force", "Force removal even with uncommitted changes")
  .action(async (branch: string, options: { force?: boolean }) => {
    try {
      const cmd = new RemoveCommand();
      const path = await cmd.execute(process.cwd(), {
        branch,
        ...(options.force ? { force: true as const } : {}),
      });
      process.stdout.write(
        `Removed worktree at ${relative(process.cwd(), path)}\n`,
      );
    } catch (error) {
      failWithError(error);
    }
  });

program
  .command("wipe")
  .alias("w")
  .description("Interactively select and remove worktrees")
  .action(async () => {
    try {
      const cmd = new WipeCommand();
      await cmd.execute(process.cwd());
    } catch (error) {
      failWithError(error);
    }
  });

program
  .command("prune")
  .alias("p")
  .description("Remove orphan worktrees whose branches were deleted on origin")
  .option("--dry-run", "Show what would be removed without doing it")
  .option("--yes", "Skip confirmation prompts")
  .option("--keep-branches", "Keep local branches after removing worktrees")
  .option("--force", "Force removal of dirty worktrees")
  .action(
    async (options: {
      dryRun?: boolean;
      yes?: boolean;
      keepBranches?: boolean;
      force?: boolean;
    }) => {
      try {
        const cmd = new PruneCommand();
        const results = await cmd.execute(process.cwd(), options);
        for (const line of results) {
          process.stdout.write(`${line}\n`);
        }
        if (results.length === 0) {
          process.stdout.write("Nothing to prune.\n");
        }
      } catch (error) {
        failWithError(error);
      }
    },
  );

export function run(argv = process.argv): void {
  program.parse(argv);
}

run();
