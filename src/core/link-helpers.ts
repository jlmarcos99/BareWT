import { randomBytes } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  readFile,
  readlink,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
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

  const createLink = async (linkPath: string, relTarget: string) => {
    if (isDirectory) {
      // "junction" avoids the symlink privilege requirement on Windows
      // (junctions store an absolute target); ignored on other platforms
      await symlink(relTarget, linkPath, "junction");
      return;
    }

    try {
      await symlink(relTarget, linkPath, "file");
    } catch (error) {
      // Windows without symlink privilege (no Developer Mode / admin):
      // fall back to a hard link, which needs no privilege
      if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
      await link(source, linkPath);
    }
  };

  for (const wtPath of worktreePaths) {
    const linkPath = join(wtPath, linkedPath);
    // Relative target must be resolved from the symlink's directory,
    // otherwise nested linked paths produce broken links.
    const relTarget = relative(dirname(linkPath), source);

    await mkdir(dirname(linkPath), { recursive: true });

    // lstat does not follow symlinks, so a link is never mistaken for
    // the real content it points to.
    const existing = await lstat(linkPath).catch(() => null);

    if (existing && !existing.isSymbolicLink()) {
      throw new Error(
        `Refusing to replace real ${
          existing.isDirectory() ? "directory" : "file"
        } at ${linkPath}; move it aside and retry.`,
      );
    }

    if (existing) {
      const currentTarget = await readlink(linkPath);
      // "junction" symlinks store an absolute target, so also compare
      // after resolving against the link's directory.
      const resolvedTarget = resolve(dirname(linkPath), currentTarget);
      if (currentTarget === relTarget || resolvedTarget === source) continue;

      // Stale or wrong link: move it aside first so it can be restored
      // if creating the replacement fails.
      const backup = `${linkPath}.bwt-${randomBytes(4).toString("hex")}.bak`;
      await rename(linkPath, backup);
      try {
        await createLink(linkPath, relTarget);
      } catch (error) {
        await rm(linkPath, { force: true }).catch(() => {});
        await rename(backup, linkPath);
        throw error;
      }
      await rm(backup, { force: true });
      continue;
    }

    await createLink(linkPath, relTarget);
  }
}

interface OpencodeConfig {
  permission?: {
    external_directory?: Record<string, string>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Reads opencode.json. Returns null when the file does not exist, throws
// when it exists but is invalid, so a broken config is never overwritten.
async function readOpencodeConfig(
  configPath: string,
): Promise<OpencodeConfig | null> {
  let raw: string;
  try {
    raw = await readFile(configPath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as OpencodeConfig;
    }
  } catch {
    // fall through to the error below
  }
  throw new Error(
    `${configPath} contains invalid JSON; fix or remove it before linking.`,
  );
}

// Linked paths point outside each worktree, which trips opencode's
// external_directory permission. Whitelist them in the project opencode.json.
export async function allowLinkedPathsInOpencode(
  projectRoot: string,
  linkedPaths: string[],
): Promise<void> {
  if (linkedPaths.length === 0) return;

  const configPath = join(projectRoot, "opencode.json");
  const config: OpencodeConfig = (await readOpencodeConfig(configPath)) ?? {};

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
