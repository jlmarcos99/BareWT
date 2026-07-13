import { getProtectedBranches } from "../utils/branch.js";
import { ensureBareRepository, git } from "../utils/git.js";
import { formatWorktreeList } from "./format.js";
import { parsePorcelain } from "./parsers.js";

export interface ListOptions {
  protected?: boolean;
  unprotected?: boolean;
}

export class ListCommand {
  async execute(cwd: string, options: ListOptions = {}): Promise<string[]> {
    await ensureBareRepository(cwd);
    const output = await git(["worktree", "list", "--porcelain"], cwd);
    let worktrees = parsePorcelain(output);

    if (options.protected) {
      const protected_ = await getProtectedBranches(cwd);
      worktrees = worktrees.filter(
        (wt) => wt.branch && protected_.has(wt.branch),
      );
    } else if (options.unprotected) {
      const protected_ = await getProtectedBranches(cwd);
      worktrees = worktrees.filter(
        (wt) => !wt.branch || !protected_.has(wt.branch),
      );
    }

    const lines = formatWorktreeList(worktrees, cwd);
    for (const line of lines) {
      process.stdout.write(`${line}\n`);
    }

    return lines;
  }
}
