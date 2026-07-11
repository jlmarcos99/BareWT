import { describe, expect, it } from "vitest";
import { formatWorktreeList } from "../../src/core/format.js";
import type { Worktree } from "../../src/core/model.js";

const cwd = "/home/user/project.git";

describe("formatWorktreeList", () => {
  it("shows hint when no worktrees", () => {
    const lines = formatWorktreeList([], cwd);
    expect(lines).toEqual([
      "No worktrees found. Create one with: bwt add <branch>",
    ]);
  });

  it("formats a single worktree", () => {
    const worktrees: Worktree[] = [
      {
        path: "/home/user/project/main",
        head: "abc1234abc1234abc1234abc1234abc1234",
        branch: "main",
      },
    ];
    const lines = formatWorktreeList(worktrees, cwd);
    expect(lines).toEqual(["main  abc1234  ../project/main"]);
  });

  it("pads branch names for alignment", () => {
    const worktrees: Worktree[] = [
      {
        path: "/home/user/project/main",
        head: "aaa1111aaa1111aaa1111aaa1111aaa1111",
        branch: "main",
      },
      {
        path: "/home/user/project/feature/login",
        head: "bbb2222bbb2222bbb2222bbb2222bbb2222",
        branch: "feature/login",
      },
    ];
    const lines = formatWorktreeList(worktrees, cwd);
    expect(lines).toEqual([
      "main           aaa1111  ../project/main",
      "feature/login  bbb2222  ../project/feature/login",
    ]);
  });

  it("shows (detached) for null branch", () => {
    const worktrees: Worktree[] = [
      {
        path: "/home/user/project/detached",
        head: "ccc3333ccc3333ccc3333ccc3333ccc3333",
        branch: null,
      },
    ];
    const lines = formatWorktreeList(worktrees, cwd);
    expect(lines).toEqual(["(detached)  ccc3333  ../project/detached"]);
  });

  it("shows dash for empty HEAD", () => {
    const worktrees: Worktree[] = [
      { path: "/home/user/project/main", head: "", branch: "main" },
    ];
    const lines = formatWorktreeList(worktrees, cwd);
    expect(lines).toEqual(["main  -  ../project/main"]);
  });
});
