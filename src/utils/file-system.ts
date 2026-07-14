import { appendFile, mkdir, readdir, rmdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function removeEmptyParents(
  leaf: string,
  stopAt: string,
): Promise<void> {
  let dir = dirname(leaf);
  while (dir !== stopAt && dir !== dirname(dir)) {
    try {
      const entries = await readdir(dir);
      if (entries.length > 0) break;
      await rmdir(dir);
      dir = dirname(dir);
    } catch {
      break;
    }
  }
}

export async function appendToInfoExclude(
  gitDir: string,
  pattern: string,
): Promise<void> {
  const excludePath = resolve(gitDir, "info", "exclude");
  const content = `\n${pattern}\n`;
  await appendFile(excludePath, content, "utf-8");
}
