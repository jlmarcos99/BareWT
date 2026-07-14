import { removeEmptyParents } from "../utils/file-system.js";
import { ensureBareRepository, git } from "../utils/git.js";
import { CliError } from "./errors.js";
import { parsePorcelain } from "./parsers.js";

export interface RemoveOptions {
  branch: string;
  force?: boolean;
}

export class RemoveCommand {
  async execute(cwd: string, options: RemoveOptions): Promise<string> {
    await ensureBareRepository(cwd);

    const output = await git(["worktree", "list", "--porcelain"], cwd);
    const worktrees = parsePorcelain(output);
    const wt = worktrees.find((w) => w.branch === options.branch);

    if (!wt) {
      throw new CliError(`no worktree found for branch '${options.branch}'`, 1);
    }

    const args = ["worktree", "remove"];
    if (options.force) {
      args.push("--force");
    }
    args.push(wt.path);

    try {
      await git(args, cwd);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("modified") || message.includes("untracked")) {
        throw new CliError(
          `worktree '${wt.path}' has uncommitted changes (use --force to override)`,
          1,
        );
      }
      throw error;
    }

    await removeEmptyParents(wt.path, cwd);
    return wt.path;
  }
}
