import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chdir, cwd } from "node:process";
import { execa } from "execa";
import { afterEach, describe, expect, it } from "vitest";
import { AddCommand } from "../../src/core/add.js";

const env = {
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "t@t.t",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "t@t.t",
};

async function initBareWithRemotes(base: string) {
  const repoDir = join(base, "repo");
  await execa("git", ["init", "-b", "main", repoDir]);
  await execa("git", ["-C", repoDir, "commit", "-m", "init", "--allow-empty"], {
    env,
  });
  await execa("git", ["-C", repoDir, "checkout", "-b", "feature/login"]);
  await execa("git", ["-C", repoDir, "commit", "-m", "feat", "--allow-empty"], {
    env,
  });

  const bareDir = join(base, "proj", ".git");
  mkdirSync(join(base, "proj"), { recursive: true });
  await execa("git", ["clone", "--bare", repoDir, bareDir]);
  await execa("git", [
    "-C",
    bareDir,
    "config",
    "remote.origin.fetch",
    "+refs/heads/*:refs/remotes/origin/*",
  ]);
  await execa("git", ["-C", bareDir, "fetch", "--all"]);

  return { bareDir };
}

describe("AddCommand", () => {
  let tmpDir: string;
  let prevCwd: string;

  afterEach(() => {
    if (prevCwd) chdir(prevCwd);
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("adds a worktree for an existing local branch", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    tmpDir = base;
    prevCwd = cwd();
    chdir(base);

    const { bareDir } = await initBareWithRemotes(base);

    const cmd = new AddCommand();
    const returnedPath = await cmd.execute(bareDir, { branch: "main" });

    const worktreeDir = join(base, "proj", "main");
    expect(returnedPath).toBe(worktreeDir);
    const { stdout } = await execa("git", [
      "-C",
      worktreeDir,
      "rev-parse",
      "--is-inside-work-tree",
    ]);
    expect(stdout.trim()).toBe("true");
  });

  it("adds a worktree for a branch with slashes", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    tmpDir = base;
    prevCwd = cwd();
    chdir(base);

    const { bareDir } = await initBareWithRemotes(base);

    const cmd = new AddCommand();
    const returnedPath = await cmd.execute(bareDir, {
      branch: "feature/login",
    });

    const worktreeDir = join(base, "proj", "feature", "login");
    expect(returnedPath).toBe(worktreeDir);
    expect(
      await execa("git", [
        "-C",
        worktreeDir,
        "rev-parse",
        "--is-inside-work-tree",
      ]),
    ).toBeTruthy();
  });

  it("adds a worktree with --new flag", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    tmpDir = base;
    prevCwd = cwd();
    chdir(base);

    const { bareDir } = await initBareWithRemotes(base);

    const cmd = new AddCommand();
    await cmd.execute(bareDir, { branch: "fix/crash", new: true });

    const { stdout } = await execa("git", [
      "-C",
      bareDir,
      "rev-parse",
      "--verify",
      "refs/heads/fix/crash",
    ]);
    expect(stdout.trim()).toBeTruthy();
  });

  it("throws if the worktree already exists", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    tmpDir = base;
    prevCwd = cwd();
    chdir(base);

    const { bareDir } = await initBareWithRemotes(base);

    const cmd = new AddCommand();
    await cmd.execute(bareDir, { branch: "main" });

    await expect(cmd.execute(bareDir, { branch: "main" })).rejects.toThrow(
      "already exists",
    );
  });

  it("throws if the branch does not exist", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    tmpDir = base;
    prevCwd = cwd();
    chdir(base);

    const { bareDir } = await initBareWithRemotes(base);

    const cmd = new AddCommand();
    await expect(
      cmd.execute(bareDir, { branch: "nonexistent" }),
    ).rejects.toThrow("not found");
  });

  it("throws when not in a bare repository", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    tmpDir = base;
    prevCwd = cwd();
    chdir(base);

    const cmd = new AddCommand();
    await expect(cmd.execute(base, { branch: "main" })).rejects.toThrow(
      "not a bare repository",
    );
  });
});
