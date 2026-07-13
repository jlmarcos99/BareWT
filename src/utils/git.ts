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
  const result = await execa("git", ["rev-parse", "--is-bare-repository"], {
    cwd,
    reject: false,
  });
  if (result.stdout.trim() !== "true") {
    throw new CliError(
      "not a bare repository (run bwt from inside the .git folder)",
      1,
    );
  }
}
