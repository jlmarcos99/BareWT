import { basename, dirname } from "node:path";
import { directoryExists, ensureDir } from "../utils/file-system.js";
import { git } from "../utils/git.js";
import { CliError } from "./errors.js";

export interface CloneOptions {
  repo: string;
  name?: string;
}

export class CloneCommand {
  async execute(options: CloneOptions): Promise<string> {
    const projectName = options.name ?? basename(options.repo, ".git");
    const bareDir = `${projectName}/.git`;

    if (await directoryExists(bareDir)) {
      throw new CliError(`${bareDir} already exists`, 1);
    }

    await ensureDir(dirname(bareDir));
    await git(["clone", "--bare", options.repo, bareDir]);
    await git([
      "-C",
      bareDir,
      "config",
      "remote.origin.fetch",
      "+refs/heads/*:refs/remotes/origin/*",
    ]);
    await git(["-C", bareDir, "fetch", "--all"]);
    return bareDir;
  }
}
