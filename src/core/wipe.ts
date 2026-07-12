import { checkbox, confirm } from "@inquirer/prompts";
import { removeEmptyParents } from "../utils/file-system.js";
import { ensureBareRepository, git } from "../utils/git.js";
import { parsePorcelain } from "./parsers.js";

async function isDirty(worktreePath: string): Promise<boolean> {
  try {
    const status = await git(["-C", worktreePath, "status", "--porcelain"]);
    return status.trim() !== "";
  } catch {
    return false;
  }
}

export class WipeCommand {
  async execute(cwd: string): Promise<void> {
    await ensureBareRepository(cwd);

    const porcelain = await git(["worktree", "list", "--porcelain"], cwd);
    const worktrees = parsePorcelain(porcelain);
    const mainBranches = new Set(["main", "master"]);

    const candidates = worktrees.filter(
      (wt) => wt.branch && !mainBranches.has(wt.branch),
    );

    if (candidates.length === 0) {
      process.stdout.write("No worktrees to wipe.\n");
      return;
    }

    const choices = candidates.map((wt) => ({
      name: wt.branch ?? "",
      value: wt,
    }));

    const selected = await checkbox({
      message: "Select worktrees to remove",
      choices,
    });

    if (selected.length === 0) {
      process.stdout.write("Cancelled.\n");
      return;
    }

    const dirtyNames: string[] = [];
    for (const wt of selected) {
      if (await isDirty(wt.path)) {
        dirtyNames.push(wt.branch ?? "");
      }
    }

    if (dirtyNames.length > 0) {
      const proceed = await confirm({
        message: `${dirtyNames.join(", ")} has uncommitted changes. Proceed anyway?`,
        default: false,
      });
      if (!proceed) {
        process.stdout.write("Cancelled.\n");
        return;
      }
    }

    for (const wt of selected) {
      await git(["worktree", "remove", "--force", wt.path], cwd);
      process.stdout.write(`Removed ${wt.branch} worktree\n`);
      await removeEmptyParents(wt.path, cwd);
    }
  }
}
