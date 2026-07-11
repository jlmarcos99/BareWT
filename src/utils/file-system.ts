import { mkdir, readdir, rmdir, stat } from "node:fs/promises";
import { dirname } from "node:path";

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
