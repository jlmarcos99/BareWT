import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";

export interface FixtureRepo {
  repoDir: string;
  bareDir: string;
  workDir: string;
}

const user = { GIT_AUTHOR_NAME: "test", GIT_COMMITTER_NAME: "test" };
const email = { GIT_AUTHOR_EMAIL: "t@t.t", GIT_COMMITTER_EMAIL: "t@t.t" };
const env = { ...user, ...email };

export async function createFixtureRepo(): Promise<FixtureRepo> {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
  const repoDir = join(base, "repo");
  const bareDir = join(base, "repo.git");
  const workDir = join(base, "work");

  await execa("git", ["init", "-b", "main", repoDir]);
  await execa("git", ["-C", repoDir, "commit", "-m", "init", "--allow-empty"], {
    env,
  });
  await execa("git", ["-C", repoDir, "checkout", "-b", "feature/login"]);
  await execa("git", ["-C", repoDir, "commit", "-m", "feat", "--allow-empty"], {
    env,
  });

  await execa("git", ["clone", "--bare", repoDir, bareDir]);

  await execa("git", [
    "-C",
    bareDir,
    "worktree",
    "add",
    join(workDir, "main"),
    "main",
  ]);
  await execa("git", [
    "-C",
    bareDir,
    "worktree",
    "add",
    join(workDir, "feature", "login"),
    "feature/login",
  ]);

  return { repoDir, bareDir, workDir };
}
