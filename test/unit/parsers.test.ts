import { describe, expect, it } from "vitest";
import { parsePorcelain } from "../../src/core/parsers.js";

const bareRepo = "/home/user/project.git";

function wt(path: string, head: string, branch: string | null) {
  return { path, head, branch };
}

describe("parsePorcelain", () => {
  it("parses a single worktree", () => {
    const output = [
      `worktree ${bareRepo}`,
      "bare",
      "",
      `worktree ${bareRepo}/../project/main`,
      "HEAD abc1234abc1234abc1234abc1234abc1234",
      "branch refs/heads/main",
      "",
    ].join("\n");

    const result = parsePorcelain(output);
    expect(result).toEqual([
      wt(
        `${bareRepo}/../project/main`,
        "abc1234abc1234abc1234abc1234abc1234",
        "main",
      ),
    ]);
  });

  it("parses multiple worktrees", () => {
    const output = [
      `worktree ${bareRepo}`,
      "bare",
      "",
      `worktree ${bareRepo}/../project/main`,
      "HEAD aaa1111aaa1111aaa1111aaa1111aaa1111",
      "branch refs/heads/main",
      "",
      `worktree ${bareRepo}/../project/feature/login`,
      "HEAD bbb2222bbb2222bbb2222bbb2222bbb2222",
      "branch refs/heads/feature/login",
      "",
    ].join("\n");

    const result = parsePorcelain(output);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(
      wt(
        `${bareRepo}/../project/main`,
        "aaa1111aaa1111aaa1111aaa1111aaa1111",
        "main",
      ),
    );
    expect(result[1]).toEqual(
      wt(
        `${bareRepo}/../project/feature/login`,
        "bbb2222bbb2222bbb2222bbb2222bbb2222",
        "feature/login",
      ),
    );
  });

  it("handles detached HEAD (no branch line)", () => {
    const output = [
      `worktree ${bareRepo}`,
      "bare",
      "",
      `worktree ${bareRepo}/../project/detached`,
      "HEAD ccc3333ccc3333ccc3333ccc3333ccc3333",
      "",
    ].join("\n");

    const result = parsePorcelain(output);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      wt(
        `${bareRepo}/../project/detached`,
        "ccc3333ccc3333ccc3333ccc3333ccc3333",
        null,
      ),
    );
  });

  it("handles repo with no commits (empty HEAD)", () => {
    const output = [
      `worktree ${bareRepo}/../project/main`,
      "HEAD",
      "branch refs/heads/main",
      "",
    ].join("\n");

    const result = parsePorcelain(output);
    expect(result).toHaveLength(1);
    expect(result[0]?.head).toBe("");
  });

  it("returns empty array for bare-only output", () => {
    const output = [`worktree ${bareRepo}`, "bare", ""].join("\n");

    const result = parsePorcelain(output);
    expect(result).toEqual([]);
  });
});
