import { basename } from "node:path";
import { input } from "@inquirer/prompts";
import { addProtectedBranch } from "../utils/branch.js";
import { git, refExists } from "../utils/git.js";
import { AddCommand } from "./add.js";
import { CloneCommand } from "./clone.js";

export interface InitOptions {
  url?: string;
  name?: string;
  yes?: boolean;
}

export class InitCommand {
  async execute(options: InitOptions = {}): Promise<void> {
    const repo =
      options.url ??
      (await input({
        message: "Repository URL",
      }));

    const defaultName = basename(repo, ".git");
    const projectName =
      options.name ??
      (await input({
        message: "Project folder name",
        default: defaultName,
      }));

    const cloneCmd = new CloneCommand();
    const bareDir = await cloneCmd.execute({
      repo,
      name: projectName,
    });
    process.stdout.write(`Cloned into ${bareDir}\n`);

    const protected_ = new Set<string>();
    const localBranches = await getLocalBranches(bareDir);
    const defaultBranch = detectDefault(localBranches);

    // Step 1: protect branches
    process.stdout.write(
      "\nProtected branches are never deleted by prune or wipe.\n",
    );

    while (true) {
      if (options.yes) break;
      const branch = await input({
        message: "Protect a branch (name, or Enter to finish)",
      });
      if (!branch.trim()) break;

      if (protected_.has(branch)) {
        process.stdout.write(`${branch} is already protected — skipping\n`);
        continue;
      }

      if (!(await refExists(bareDir, `refs/heads/${branch}`))) {
        process.stdout.write(`Branch '${branch}' not found — skipping\n`);
        continue;
      }

      await addProtectedBranch(bareDir, branch);
      protected_.add(branch);
      process.stdout.write(`Protected ${branch}\n`);
    }

    // Always protect the default branch
    if (!protected_.has(defaultBranch)) {
      await addProtectedBranch(bareDir, defaultBranch);
      protected_.add(defaultBranch);
    }

    const worktreesCreated: string[] = [];

    // Step 2: create worktrees for all protected branches
    for (const branch of protected_) {
      const addCmd = new AddCommand();
      await addCmd.execute(bareDir, { branch });
      process.stdout.write(`Created worktree for ${branch}\n`);
      worktreesCreated.push(branch);
    }

    // Step 3: additional worktrees for non-protected branches
    const remaining = localBranches.filter((b) => !protected_.has(b));
    if (remaining.length > 0) {
      while (true) {
        if (options.yes) break;
        const branch = await input({
          message: "Add another worktree (name, or Enter to finish)",
        });
        if (!branch.trim()) break;

        if (!localBranches.includes(branch)) {
          process.stdout.write(`Branch '${branch}' not found — skipping\n`);
          continue;
        }

        const addCmd = new AddCommand();
        await addCmd.execute(bareDir, { branch });
        process.stdout.write(`Created worktree for ${branch}\n`);
        worktreesCreated.push(branch);
      }
    }

    // Summary
    process.stdout.write("\n");
    process.stdout.write("Summary:\n");
    const wtList =
      worktreesCreated.length > 0 ? worktreesCreated.join(", ") : "(none)";
    process.stdout.write(`  Worktrees: ${wtList}\n`);
    process.stdout.write(`  Protected: ${[...protected_].join(", ")}\n`);
    process.stdout.write("\n");
    process.stdout.write(`Ready! cd ${bareDir} to get started\n`);
    process.stdout.write("  bwt list      show your worktrees\n");
    process.stdout.write("  bwt add       create more worktrees later\n");
    process.stdout.write("  bwt protect   protect more branches later\n");
  }
}

async function getLocalBranches(bareDir: string): Promise<string[]> {
  try {
    const refs = await git(
      ["for-each-ref", "--format=%(refname:short)", "refs/heads/"],
      bareDir,
    );
    return refs
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
  } catch {
    return [];
  }
}

function detectDefault(branches: string[]): string {
  if (branches.includes("main")) return "main";
  if (branches.includes("master")) return "master";
  if (branches.includes("trunk")) return "trunk";
  if (branches.includes("develop")) return "develop";
  return branches[0] ?? "main";
}
