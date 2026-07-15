import { link, mkdir, rm, stat, symlink } from "node:fs/promises";
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
  const isDirectory = (await stat(source)).isDirectory();

  for (const wtPath of worktreePaths) {
    const linkPath = join(wtPath, linkedPath);
    const relTarget = relative(wtPath, source);

    await mkdir(dirname(linkPath), { recursive: true });
    await rm(linkPath, { recursive: true, force: true });

    if (isDirectory) {
      // "junction" avoids the symlink privilege requirement on Windows
      // (junctions store an absolute target); ignored on other platforms
      await symlink(relTarget, linkPath, "junction");
      continue;
    }

    try {
      await symlink(relTarget, linkPath, "file");
    } catch (error) {
      // Windows without symlink privilege (no Developer Mode / admin):
      // fall back to a hard link, which needs no privilege
      if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
      await link(source, linkPath);
    }
  }
}
