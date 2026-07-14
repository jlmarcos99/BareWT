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

export async function ensureBareRepository(cwd: string): Promise<void> {
  let gitDir: string;
  try {
    gitDir = await git(["rev-parse", "--git-dir"], cwd);
  } catch {
    throw new CliError(
      "not a bare repository (run bwt from inside the .git folder)",
      1,
    );
  }
  const absGitDir = isAbsolute(gitDir) ? gitDir : resolve(cwd, gitDir);
  const result = await execa(
    "git",
    ["-C", absGitDir, "rev-parse", "--is-bare-repository"],
    {
      reject: false,
    },
  );
  if (result.stdout.trim() !== "true") {
    throw new CliError(
      "not a bare repository (run bwt from inside the .git folder)",
      1,
    );
  }
}
