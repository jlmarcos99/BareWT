import { relative } from "node:path";
import type { Worktree } from "./model.js";

export function formatWorktreeList(
  worktrees: Worktree[],
  cwd: string,
): string[] {
  if (worktrees.length === 0) {
    return ["No worktrees found. Create one with: bwt add <branch>"];
  }

  const maxBranchLen = Math.max(
    ...worktrees.map((w) => (w.branch ?? "(detached)").length),
  );

  return worktrees.map((w) => {
    const branch = (w.branch ?? "(detached)").padEnd(maxBranchLen);
    const sha = w.head.slice(0, 7) || "-";
    const relPath = relative(cwd, w.path);
    return `${branch}  ${sha}  ${relPath}`;
  });
}
