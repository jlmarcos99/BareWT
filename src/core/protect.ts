import { addProtectedBranch } from "../utils/branch.js";
import { ensureBareRepository, refExists } from "../utils/git.js";
import { CliError } from "./errors.js";

export class ProtectCommand {
  async execute(cwd: string, branch: string): Promise<void> {
    await ensureBareRepository(cwd);

    if (!(await refExists(cwd, `refs/heads/${branch}`))) {
      throw new CliError(`branch '${branch}' does not exist`, 1);
    }

    await addProtectedBranch(cwd, branch);
  }
}
