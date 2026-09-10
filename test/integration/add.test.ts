import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { lstat } from "node:fs/promises";
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

  it("runs from inside an existing worktree", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    tmpDir = base;
    prevCwd = cwd();
    chdir(base);

    const { bareDir } = await initBareWithRemotes(base);

    const cmd = new AddCommand();
    await cmd.execute(bareDir, { branch: "main" });

    const mainWorktree = join(base, "proj", "main");
    const returnedPath = await new AddCommand().execute(mainWorktree, {
      branch: "feature/login",
    });

    expect(returnedPath).toBe(join(base, "proj", "feature", "login"));
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

  it("creates a new branch from an origin and adds its worktree", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    tmpDir = base;
    prevCwd = cwd();
    chdir(base);

    const { bareDir } = await initBareWithRemotes(base);

    const cmd = new AddCommand();
    await cmd.execute(bareDir, {
      branch: "feat/from-main",
      origin: "main",
    });

    const { stdout } = await execa("git", [
      "-C",
      bareDir,
      "rev-parse",
      "--verify",
      "refs/heads/feat/from-main",
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

  it("creates symlinks for linked paths in new worktrees", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    tmpDir = base;
    prevCwd = cwd();
    chdir(base);

    const { bareDir } = await initBareWithRemotes(base);

    const projectRoot = join(base, "proj");
    mkdirSync(join(projectRoot, "shared"), { recursive: true });
    await execa("git", [
      "-C",
      bareDir,
      "config",
      "--add",
      "bwt.linked",
      "shared",
    ]);

    const cmd = new AddCommand();
    await cmd.execute(bareDir, { branch: "main" });

    const linkPath = join(projectRoot, "main", "shared");
    const stat = await lstat(linkPath);
    expect(stat.isSymbolicLink()).toBe(true);
  });

  it("fast-forwards the new worktree to the remote branch", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    tmpDir = base;
    prevCwd = cwd();
    chdir(base);

    const { bareDir } = await initBareWithRemotes(base);

    // Advance feature/login on the remote after the bare clone was made.
    const repoDir = join(base, "repo");
    await execa(
      "git",
      ["-C", repoDir, "commit", "-m", "more", "--allow-empty"],
      {
        env,
      },
    );

    const cmd = new AddCommand();
    const worktreeDir = await cmd.execute(bareDir, {
      branch: "feature/login",
    });

    const { stdout } = await execa("git", [
      "-C",
      worktreeDir,
      "rev-list",
      "--count",
      "HEAD",
    ]);
    expect(Number(stdout.trim())).toBe(3);
  });

  it("creates working symlinks for nested linked paths", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    tmpDir = base;
    prevCwd = cwd();
    chdir(base);

    const { bareDir } = await initBareWithRemotes(base);

    const projectRoot = join(base, "proj");
    const nestedSource = join(projectRoot, "config", "secrets");
    mkdirSync(nestedSource, { recursive: true });
    writeFileSync(join(nestedSource, "key.txt"), "secret");
    await execa("git", [
      "-C",
      bareDir,
      "config",
      "--add",
      "bwt.linked",
      "config/secrets",
    ]);

    const cmd = new AddCommand();
    await cmd.execute(bareDir, { branch: "main" });

    const linkPath = join(projectRoot, "main", "config", "secrets");
    const stat = await lstat(linkPath);
    expect(stat.isSymbolicLink()).toBe(true);
    expect(readFileSync(join(linkPath, "key.txt"), "utf-8")).toBe("secret");
  });
});
