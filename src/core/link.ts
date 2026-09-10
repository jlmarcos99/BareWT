import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { appendToInfoExclude } from "../utils/file-system.js";
import { ensureBareRepository, getCommonDir, git } from "../utils/git.js";
import { CliError } from "./errors.js";
import {
  allowLinkedPathsInOpencode,
  createLinkedSymlinks,
  getLinkedPaths,
} from "./link-helpers.js";
import { parsePorcelain } from "./parsers.js";

export class LinkCommand {
  async execute(
    cwd: string,
    path?: string,
    syncOnly = false,
  ): Promise<string[] | undefined> {
    await ensureBareRepository(cwd);

    if (!path && !syncOnly) {
      const paths = await getLinkedPaths(cwd);
      for (const p of paths) {
        process.stdout.write(`${p}\n`);
      }
      return paths;
    }

    const commonDir = await getCommonDir(cwd);
    const projectRoot = resolve(commonDir, "..");

    if (!syncOnly && path) {
      const sourcePath = join(projectRoot, path);
      try {
        await stat(sourcePath);
      } catch {
        throw new CliError(
          `path '${path}' not found at ${sourcePath}\n` +
            "The linked path must exist at the project root (next to .git)",
          1,
        );
      }

      await appendToInfoExclude(commonDir, path);
      await git(["config", "--add", "bwt.linked", path], cwd);
    }

    const registered = await getLinkedPaths(cwd);
    const pathsToLink = syncOnly ? registered : path ? [path] : [];

    const porcelain = await git(["worktree", "list", "--porcelain"], cwd);
    const worktrees = parsePorcelain(porcelain);

    for (const linkedPath of pathsToLink) {
      await createLinkedSymlinks(
        projectRoot,
        worktrees.map((w) => w.path),
        linkedPath,
      );
    }

    await allowLinkedPathsInOpencode(projectRoot, pathsToLink);
  }
}
