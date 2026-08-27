import { rm } from "node:fs/promises";
import { checkbox, confirm } from "@inquirer/prompts";
import { getProtectedBranches } from "../utils/branch.js";
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
    const protectedBranches = await getProtectedBranches(cwd);

    const candidates = worktrees.filter(
      (wt) => wt.branch && !protectedBranches.has(wt.branch),
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
      try {
        // Two --force flags: needed when the worktree is dirty AND has
        // untracked files; a single one leaves the folder behind.
        await git(["worktree", "remove", "--force", "--force", wt.path], cwd);
        await rm(wt.path, { recursive: true, force: true });
        process.stdout.write(`Removed ${wt.branch} worktree\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Failed to remove ${wt.branch}: ${message}\n`);
        const skip = await confirm({
          message: "Skip this worktree and continue with the rest?",
          default: true,
        });
        if (!skip) {
          process.stdout.write("Cancelled.\n");
          return;
        }
        continue;
      }
      await removeEmptyParents(wt.path, cwd);
    }
  }
}
