import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
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
    // Relative target must be resolved from the symlink's directory,
    // otherwise nested linked paths produce broken links.
    const relTarget = relative(dirname(linkPath), source);

    await mkdir(dirname(linkPath), { recursive: true });
    await rm(linkPath, { recursive: true, force: true });

    await symlink(relTarget, linkPath);
  }
}

interface OpencodeConfig {
  permission?: {
    external_directory?: Record<string, string>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Linked paths point outside each worktree, which trips opencode's
// external_directory permission. Whitelist them in the project opencode.json.
export async function allowLinkedPathsInOpencode(
  projectRoot: string,
  linkedPaths: string[],
): Promise<void> {
  if (linkedPaths.length === 0) return;

  const configPath = join(projectRoot, "opencode.json");
  let config: OpencodeConfig = {};
  try {
    const parsed: unknown = JSON.parse(await readFile(configPath, "utf-8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      config = parsed as OpencodeConfig;
    }
  } catch {
    // Missing or invalid file: start fresh.
  }

  if (!config.permission) config.permission = {};
  if (!config.permission.external_directory) {
    config.permission.external_directory = {};
  }
  const external = config.permission.external_directory;
  for (const linkedPath of linkedPaths) {
    const abs = join(projectRoot, linkedPath);
    external[abs] = "allow";
    external[join(abs, "**")] = "allow";
  }

  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

export async function denyLinkedPathInOpencode(
  projectRoot: string,
  linkedPath: string,
): Promise<void> {
  const configPath = join(projectRoot, "opencode.json");
  let config: OpencodeConfig;
  try {
    config = JSON.parse(await readFile(configPath, "utf-8"));
  } catch {
    return;
  }

  const external = config.permission?.external_directory;
  if (!external) return;

  const abs = join(projectRoot, linkedPath);
  delete external[abs];
  delete external[join(abs, "**")];

  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
}
