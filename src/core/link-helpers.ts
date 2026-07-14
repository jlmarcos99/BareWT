import { mkdir, rm, symlink } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { git } from "../utils/git.js";

export async function getLinkedPaths(cwd: string): Promise<string[]> {
  try {
    const output = await git(["config", "--get-all", "bwt.linked"], cwd);
    return output
      .trim()
      .split("\n")
      .filter((l) => l.length > 0);
  } catch {
    return [];
  }
}

export async function createLinkedSymlinks(
  projectRoot: string,
  worktreePaths: string[],
  linkedPath: string,
): Promise<void> {
  const source = join(projectRoot, linkedPath);

  for (const wtPath of worktreePaths) {
    const linkPath = join(wtPath, linkedPath);
    const relTarget = relative(wtPath, source);

    await mkdir(dirname(linkPath), { recursive: true });
    await rm(linkPath, { recursive: true, force: true });

    await symlink(relTarget, linkPath);
  }
}
