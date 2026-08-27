import { isAbsolute, join, resolve } from "node:path";
import { ensureBareRepository, git, refExists } from "../utils/git.js";
import { CliError } from "./errors.js";
import { createLinkedSymlinks, getLinkedPaths } from "./link-helpers.js";
import { parsePorcelain } from "./parsers.js";

export interface AddOptions {
  branch: string;
  new?: boolean;
  origin?: string;
}

export class AddCommand {
  async execute(cwd: string, options: AddOptions): Promise<string> {
    await ensureBareRepository(cwd);

    const gitDir = await git(["rev-parse", "--git-dir"], cwd);
    const absGitDir = isAbsolute(gitDir) ? gitDir : resolve(cwd, gitDir);
    const projectRoot = resolve(absGitDir, "..");
    const worktreePath = join(projectRoot, options.branch);

    const existing = await git(["worktree", "list", "--porcelain"], cwd);
    const worktrees = parsePorcelain(existing);
    const alreadyExists = worktrees.some((w) => w.branch === options.branch);
    if (alreadyExists) {
      throw new CliError(
        `worktree for branch '${options.branch}' already exists`,
        1,
      );
    }

    if (!options.new && !options.origin) {
      const existsLocally = await refExists(
        cwd,
        `refs/heads/${options.branch}`,
      );
      if (!existsLocally) {
        let fetchFailed = false;
        try {
          await git(["fetch", "origin"], cwd);
        } catch {
          fetchFailed = true;
        }

        const existsRemotely = await refExists(
          cwd,
          `refs/remotes/origin/${options.branch}`,
        );
        if (!existsRemotely) {
          const hint = fetchFailed ? " (could not fetch from origin)" : "";
          throw new CliError(`branch '${options.branch}' not found${hint}`, 1);
        }
      }
    }

    if (options.origin) {
      await git(
        ["worktree", "add", "-b", options.branch, worktreePath, options.origin],
        cwd,
      );
    } else if (options.new) {
      await git(["worktree", "add", "-b", options.branch, worktreePath], cwd);
    } else {
      await git(["worktree", "add", worktreePath, options.branch], cwd);
    }

    if (!options.new) {
      // Sync the new worktree with the remote so it is not created stale.
      // Merge against origin/<branch> directly: local branches created by a
      // bare clone usually have no upstream configured, so `git pull` fails.
      try {
        await git(["fetch", "origin"], cwd);
      } catch {
        // No remote or network error; nothing to sync with.
      }
      if (await refExists(cwd, `refs/remotes/origin/${options.branch}`)) {
        try {
          await git(
            [
              "-C",
              worktreePath,
              "merge",
              "--ff-only",
              `origin/${options.branch}`,
            ],
            cwd,
          );
        } catch {
          process.stderr.write(
            `Warning: could not fast-forward '${options.branch}' to origin; the worktree may be outdated.\n`,
          );
        }
      }
    }

    const linked = await getLinkedPaths(cwd);
    for (const linkedPath of linked) {
      await createLinkedSymlinks(projectRoot, [worktreePath], linkedPath);
    }

    return worktreePath;
  }
}
