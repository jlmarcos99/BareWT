import { rm } from "node:fs/promises";
import { join } from "node:path";
import { ensureBareRepository, git } from "../utils/git.js";
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
  }
}
