import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chdir, cwd } from "node:process";
import { execa } from "execa";
import { afterEach, describe, expect, it } from "vitest";
import { CloneCommand } from "../../src/core/clone.js";

const env = {
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "t@t.t",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "t@t.t",
};

async function initRepo(dir: string) {
  await execa("git", ["init", "-b", "main", dir]);
  await execa("git", ["-C", dir, "commit", "-m", "init", "--allow-empty"], {
    env,
  });
}

describe("CloneCommand", () => {
  let tmpDir: string;
  let prevCwd: string;

  afterEach(() => {
    if (prevCwd) {
      chdir(prevCwd);
    }
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("creates a bare clone in <name>/.git", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    tmpDir = base;
    prevCwd = cwd();
    chdir(base);

    const repoDir = join(base, "repo");
    await initRepo(repoDir);

    const cmd = new CloneCommand();
    await cmd.execute({ repo: repoDir, name: "proj" });

    const bareDir = join(base, "proj", ".git");
    const { stdout } = await execa("git", [
      "-C",
      bareDir,
      "rev-parse",
      "--is-bare-repository",
    ]);
    expect(stdout.trim()).toBe("true");
  });

  it("throws if the target directory already exists", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    tmpDir = base;
    prevCwd = cwd();
    chdir(base);

    const repoDir = join(base, "repo");
    await initRepo(repoDir);

    const cmd = new CloneCommand();
    await cmd.execute({ repo: repoDir, name: "proj" });

    await expect(cmd.execute({ repo: repoDir, name: "proj" })).rejects.toThrow(
      "proj/.git already exists",
    );
  });

  it("derives the folder name from the repo URL", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    tmpDir = base;
    prevCwd = cwd();
    chdir(base);

    const repoDir = join(base, "my-repo.git");
    await initRepo(repoDir);

    const cmd = new CloneCommand();
    await cmd.execute({ repo: repoDir });

    const bareDir = join(base, "my-repo", ".git");
    const { stdout } = await execa("git", [
      "-C",
      bareDir,
      "rev-parse",
      "--is-bare-repository",
    ]);
    expect(stdout.trim()).toBe("true");
  });
});
