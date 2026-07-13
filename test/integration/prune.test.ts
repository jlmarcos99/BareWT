import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { afterEach, describe, expect, it } from "vitest";
import { PruneCommand } from "../../src/core/prune.js";

const env = {
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "t@t.t",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "t@t.t",
};

async function setupGoneBare(base: string) {
  const repoDir = join(base, "repo");
  await execa("git", ["init", "-b", "main", repoDir]);
  await execa("git", ["-C", repoDir, "commit", "-m", "init", "--allow-empty"], {
    env,
  });
  await execa("git", ["-C", repoDir, "checkout", "-b", "feat/done"]);
  await execa("git", ["-C", repoDir, "commit", "-m", "feat", "--allow-empty"], {
    env,
  });
  await execa("git", ["-C", repoDir, "checkout", "main"]);

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

  await execa("git", [
    "-C",
    bareDir,
    "worktree",
    "add",
    join(base, "proj", "main"),
    "main",
  ]);
  await execa("git", [
    "-C",
    bareDir,
    "branch",
    "--set-upstream-to=origin/feat/done",
    "feat/done",
  ]);
  await execa("git", [
    "-C",
    bareDir,
    "worktree",
    "add",
    join(base, "proj", "feat", "done"),
    "feat/done",
  ]);

  await execa("git", ["-C", repoDir, "branch", "-D", "feat/done"]);

  return { bareDir };
}

describe("PruneCommand", () => {
  let cleanupDir: string | undefined;

  afterEach(() => {
    if (cleanupDir) {
      rmSync(cleanupDir, { recursive: true, force: true });
      cleanupDir = undefined;
    }
  });

  it("prunes [gone] worktrees in dry-run mode", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    cleanupDir = base;

    const { bareDir } = await setupGoneBare(base);

    const cmd = new PruneCommand();
    const results = await cmd.execute(bareDir, { dryRun: true });

    expect(results[0]).toContain("would remove feat/done");
  });

  it("removes [gone] worktrees and their branches", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    cleanupDir = base;

    const { bareDir } = await setupGoneBare(base);

    const cmd = new PruneCommand();
    const results = await cmd.execute(bareDir, {});

    expect(results).toContain("removed feat/done worktree");
    expect(results).toContain("deleted branch feat/done");
  });

  it("keeps branches with --keep-branches", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    cleanupDir = base;

    const { bareDir } = await setupGoneBare(base);

    const cmd = new PruneCommand();
    const results = await cmd.execute(bareDir, { keepBranches: true });

    expect(results).toContain("removed feat/done worktree");
    expect(results.some((r) => r.startsWith("deleted branch"))).toBe(false);
  });

  it("throws when not in a bare repository", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    cleanupDir = base;

    const cmd = new PruneCommand();
    await expect(cmd.execute(base, {})).rejects.toThrow(
      "not a bare repository",
    );
  });

  it("skips branches protected via git config", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    cleanupDir = base;

    const { bareDir } = await setupGoneBare(base);

    // Mark feat/done as protected
    await execa("git", [
      "-C",
      bareDir,
      "config",
      "--add",
      "bwt.protected",
      "feat/done",
    ]);

    const cmd = new PruneCommand();
    const results = await cmd.execute(bareDir, { dryRun: true });

    expect(results).toEqual([]);
  });
});
