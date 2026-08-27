#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { AddCommand } from "../core/add.js";
import { CloneCommand } from "../core/clone.js";
import { InitCommand } from "../core/init.js";
import { LinkCommand } from "../core/link.js";
import { ListCommand } from "../core/list.js";
import { ProtectCommand } from "../core/protect.js";
import { PruneCommand } from "../core/prune.js";
import { RemoveCommand } from "../core/remove.js";
import { UnlinkCommand } from "../core/unlink.js";
import { UnprotectCommand } from "../core/unprotect.js";
import { WipeCommand } from "../core/wipe.js";
import { createSpinner } from "../utils/index.js";

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
  .command("init [url]")
  .alias("i")
  .description("Interactive wizard to set up a new project")
  .option("-n, --name <name>", "Project folder name")
  .option("-a, --auto", "Fully automated — no prompts, uses defaults")
  .action(
    async (
      url: string | undefined,
      options: {
        name?: string;
        auto?: boolean;
      },
    ) => {
      try {
        const cmd = new InitCommand();
        const opts: { url?: string; name?: string; auto?: boolean } = {};
        if (url !== undefined) opts.url = url;
        if (options.name !== undefined) opts.name = options.name;
        if (options.auto !== undefined) opts.auto = options.auto;
        await cmd.execute(opts);
      } catch (error) {
        failWithError(error);
      }
    },
  );

program
  .command("clone <repo> [name]")
  .alias("c")
  .description("Create a bare clone of a repository")
  .action(async (repo: string, name?: string) => {
    try {
      const cmd = new CloneCommand();
      const spinner = createSpinner("Cloning repository…");
      let bareDir: string;
      try {
        bareDir = await cmd.execute(
          name === undefined ? { repo } : { repo, name },
        );
      } catch (error) {
        spinner.fail();
        throw error;
      }
      spinner.succeed("Repository cloned");
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
  .command("add <branch> [origin]")
  .alias("a")
  .description(
    "Add a worktree for a branch, or create a new branch from an origin",
  )
  .option("-n, --new", "Create a new branch before adding the worktree")
  .action(
    async (
      branch: string,
      origin: string | undefined,
      options: { new?: boolean },
    ) => {
      try {
        const cmd = new AddCommand();
        const opts: { branch: string; new?: boolean; origin?: string } = {
          branch,
        };
        if (options.new) opts.new = true;
        if (origin !== undefined) opts.origin = origin;
        const spinner = createSpinner(`Adding worktree for ${branch}…`);
        let path: string;
        try {
          path = await cmd.execute(process.cwd(), opts);
        } catch (error) {
          spinner.fail();
          throw error;
        }
        spinner.succeed(`Worktree added for ${branch}`);
        const relPath = relative(process.cwd(), path);
        process.stdout.write(`Added worktree at ${relPath}\n`);
        process.stdout.write(`To start working: cd ${relPath}\n`);
      } catch (error) {
        failWithError(error);
      }
    },
  );

program
  .command("link [path]")
  .alias("lk")
  .description("Link a shared path, or list linked paths if no argument given")
  .option("-s, --sync", "Recreate symlinks for all registered paths")
  .action(async (path: string | undefined, options: { sync?: boolean }) => {
    try {
      const cmd = new LinkCommand();
      await cmd.execute(process.cwd(), path, options.sync);
      if (path && !options.sync) {
        process.stdout.write(`Linked ${path}\n`);
      }
      if (options.sync) {
        process.stdout.write("Synced linked paths\n");
      }
    } catch (error) {
      failWithError(error);
    }
  });

program
  .command("unlink <path>")
  .alias("ul")
  .description("Remove a shared path symlink from all worktrees")
  .action(async (path: string) => {
    try {
      const cmd = new UnlinkCommand();
      await cmd.execute(process.cwd(), path);
      process.stdout.write(`Unlinked ${path}\n`);
    } catch (error) {
      failWithError(error);
    }
  });

program
  .command("list")
  .alias("l")
  .description("List all active worktrees")
  .option("-p, --protected", "Show only protected worktrees")
  .option("-u, --unprotected", "Show only unprotected worktrees")
  .action(async (options: { protected?: boolean; unprotected?: boolean }) => {
    try {
      const cmd = new ListCommand();
      await cmd.execute(process.cwd(), options);
    } catch (error) {
      failWithError(error);
    }
  });

program
  .command("remove <branch>")
  .alias("r")
  .description("Remove a worktree (does not delete the branch)")
  .option("-f, --force", "Force removal even with uncommitted changes")
  .action(async (branch: string, options: { force?: boolean }) => {
    try {
      const cmd = new RemoveCommand();
      const spinner = createSpinner(`Removing worktree ${branch}…`);
      let path: string;
      try {
        path = await cmd.execute(process.cwd(), {
          branch,
          ...(options.force ? { force: true as const } : {}),
        });
      } catch (error) {
        spinner.fail();
        throw error;
      }
      spinner.succeed(`Worktree ${branch} removed`);
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
  .option("-d, --dry-run", "Show what would be removed without doing it")
  .option("-y, --yes", "Skip confirmation prompts")
  .option("-k, --keep-branches", "Keep local branches after removing worktrees")
  .option("-f, --force", "Force removal of dirty worktrees")
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

program
  .command("protect <branch>")
  .alias("pt")
  .description("Mark a branch as protected from prune/wipe")
  .action(async (branch: string) => {
    try {
      const cmd = new ProtectCommand();
      await cmd.execute(process.cwd(), branch);
      process.stdout.write(`Protected ${branch}\n`);
    } catch (error) {
      failWithError(error);
    }
  });

program
  .command("unprotect <branch>")
  .alias("up")
  .description("Remove protection from a branch")
  .action(async (branch: string) => {
    try {
      const cmd = new UnprotectCommand();
      await cmd.execute(process.cwd(), branch);
      process.stdout.write(`Unprotected ${branch}\n`);
    } catch (error) {
      failWithError(error);
    }
  });

export function run(argv = process.argv): void {
  program.parse(argv);
}

run();
