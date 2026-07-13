import { execa } from "execa";
import { git, refExists } from "./git.js";

const PROTECTED_CANDIDATES = ["main", "master", "trunk", "develop"];

export async function getProtectedBranches(cwd: string): Promise<Set<string>> {
  const protected_ = new Set<string>();

  try {
    const ref = await git(["symbolic-ref", "refs/remotes/origin/HEAD"], cwd);
    const prefix = "refs/remotes/origin/";
    if (ref.trim().startsWith(prefix)) {
      protected_.add(ref.trim().slice(prefix.length));
    }
  } catch {
    // symbolic-ref fails when origin is not configured or origin/HEAD
    // is missing from the remote — both are expected and harmless.
  }

  for (const candidate of PROTECTED_CANDIDATES) {
    if (await refExists(cwd, `refs/heads/${candidate}`)) {
      protected_.add(candidate);
    }
  }

  // Read user-configured protected branches from git config
  try {
    const { stdout } = await execa(
      "git",
      ["config", "--get-all", "bwt.protected"],
      {
        cwd,
        reject: false,
      },
    );
    for (const line of stdout.trim().split("\n")) {
      const name = line.trim();
      if (name) protected_.add(name);
    }
  } catch {
    // no user-configured protected branches
  }

  // At minimum protect "main" — even if no branches exist yet.
  if (protected_.size === 0) {
    protected_.add("main");
  }

  return protected_;
}

export async function addProtectedBranch(
  cwd: string,
  branch: string,
): Promise<void> {
  await git(["config", "--add", "bwt.protected", branch], cwd);
}

export async function removeProtectedBranch(
  cwd: string,
  branch: string,
): Promise<void> {
  await git(["config", "--unset", "bwt.protected", branch], cwd);
}
