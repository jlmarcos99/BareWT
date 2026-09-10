import { isAbsolute, resolve } from "node:path";
import { execa } from "execa";
import { CliError } from "../core/errors.js";

export async function git(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await execa("git", args, cwd ? { cwd } : undefined);
  return stdout;
}

export async function refExists(cwd: string, ref: string): Promise<boolean> {
  try {
    await git(["rev-parse", "--verify", ref], cwd);
    return true;
  } catch {
    return false;
  }
}

// Resolves the common git dir, which is the bare .git folder both when
// bwt runs inside it and when it runs from any of its worktrees.
export async function getCommonDir(cwd: string): Promise<string> {
  let gitDir: string;
  try {
    gitDir = await git(["rev-parse", "--git-common-dir"], cwd);
  } catch {
    throw new CliError(
      "not a bare repository (run bwt from inside the bare .git folder or any of its worktrees)",
      1,
    );
  }
  return isAbsolute(gitDir) ? gitDir : resolve(cwd, gitDir);
}

export async function ensureBareRepository(cwd: string): Promise<void> {
  const commonDir = await getCommonDir(cwd);
  const result = await execa(
    "git",
    ["-C", commonDir, "rev-parse", "--is-bare-repository"],
    {
      reject: false,
    },
  );
  if (result.stdout.trim() !== "true") {
    throw new CliError(
      "not a bare repository (run bwt from inside the bare .git folder or any of its worktrees)",
      1,
    );
  }
}
