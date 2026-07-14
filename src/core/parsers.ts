import type { Worktree } from "./model.js";

function finalize(current: Partial<Worktree>): Worktree {
  return {
    path: current.path ?? "",
    head: current.head ?? "",
    branch: current.branch ?? null,
  };
}

export function parsePorcelain(output: string): Worktree[] {
  const worktrees: Worktree[] = [];
  const lines = output.split("\n");
  let current: Partial<Worktree> = {};
  let inWorktree = false;

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      if (inWorktree && current.path !== undefined) {
        worktrees.push(finalize(current));
      }
      current = { path: line.slice("worktree ".length) };
      inWorktree = true;
    } else if (line === "bare") {
      inWorktree = false;
      current = {};
    } else if (line === "HEAD") {
      current.head = "";
    } else if (line.startsWith("HEAD ")) {
      current.head = line.slice("HEAD ".length);
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).replace("refs/heads/", "");
    }
  }

  if (inWorktree && current.path !== undefined) {
    worktrees.push(finalize(current));
  }

  return worktrees;
}
