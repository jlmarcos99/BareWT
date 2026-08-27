import { rm } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { ensureBareRepository, git } from "../utils/git.js";
import { denyLinkedPathInOpencode } from "./link-helpers.js";
import { parsePorcelain } from "./parsers.js";

export class UnlinkCommand {
  async execute(cwd: string, path: string): Promise<void> {
    await ensureBareRepository(cwd);

    const porcelain = await git(["worktree", "list", "--porcelain"], cwd);
    const worktrees = parsePorcelain(porcelain);

    for (const wt of worktrees) {
      const linkPath = join(wt.path, path);
      await rm(linkPath, { recursive: true, force: true });
    }

    await git(["config", "--unset-all", "bwt.linked", path], cwd);

    const gitDir = await git(["rev-parse", "--git-dir"], cwd);
    const absGitDir = isAbsolute(gitDir) ? gitDir : resolve(cwd, gitDir);
    await denyLinkedPathInOpencode(resolve(absGitDir, ".."), path);
  }
}
