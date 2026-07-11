import { ensureBareRepository, git } from "../utils/git.js";
import { formatWorktreeList } from "./format.js";
import { parsePorcelain } from "./parsers.js";

export class ListCommand {
  async execute(cwd: string): Promise<void> {
    await ensureBareRepository(cwd);
    const output = await git(["worktree", "list", "--porcelain"], cwd);
    const worktrees = parsePorcelain(output);
    const lines = formatWorktreeList(worktrees, cwd);
    for (const line of lines) {
      process.stdout.write(`${line}\n`);
    }
  }
}
