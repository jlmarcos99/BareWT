import { removeEmptyParents } from "../utils/file-system.js";
import { ensureBareRepository, git } from "../utils/git.js";
import { parsePorcelain } from "./parsers.js";

export interface PruneOptions {
  dryRun?: boolean;
  yes?: boolean;
  keepBranches?: boolean;
  force?: boolean;
}

export class PruneCommand {
  async execute(cwd: string, options: PruneOptions): Promise<string[]> {
    await ensureBareRepository(cwd);

    await git(["fetch", "--prune", "origin"], cwd);

    const refs = await git(
      [
        "for-each-ref",
        "--format=%(refname:short) %(upstream:track)",
        "refs/heads/",
      ],
      cwd,
    );

    const goneBranches = refs
      .split("\n")
      .filter((line) => line.includes("[gone]"))
      .map((line) => line.split(" ")[0] ?? "");

    const porcelain = await git(["worktree", "list", "--porcelain"], cwd);
    const worktrees = parsePorcelain(porcelain);

    const results: string[] = [];
    const mainBranches = new Set(["main", "master"]);

    for (const branch of goneBranches) {
      if (mainBranches.has(branch)) continue;

      const wt = worktrees.find((w) => w.branch === branch);
      if (!wt) {
        if (!options.keepBranches) {
          await git(["branch", "-d", branch], cwd);
        }
        continue;
      }

      let dirty = false;
      try {
        const status = await git(["-C", wt.path, "status", "--porcelain"], cwd);
        if (status.trim() !== "") dirty = true;
      } catch {
        // worktree might be missing
      }

      if (dirty && !options.force) {
        results.push(
          `skipped ${branch}: worktree has uncommitted changes (use --force)`,
        );
        continue;
      }

      if (options.dryRun) {
        results.push(`would remove ${branch} at ${wt.path}`);
        continue;
      }

      await git(["worktree", "remove", "--force", wt.path], cwd);
      results.push(`removed ${branch} worktree`);

      if (!options.keepBranches) {
        await git(["branch", "-D", branch], cwd);
        results.push(`deleted branch ${branch}`);
      }

      await removeEmptyParents(wt.path, cwd);
    }

    await git(["worktree", "prune"], cwd);

    return results;
  }
}
