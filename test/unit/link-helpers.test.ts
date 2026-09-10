import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  link: vi.fn(),
  lstat: vi.fn(),
  mkdir: vi.fn(),
  readlink: vi.fn(),
  rename: vi.fn(),
  rm: vi.fn(),
  stat: vi.fn(),
  symlink: vi.fn(),
}));

vi.mock("node:fs/promises", () => fs);

import { createLinkedSymlinks } from "../../src/core/link-helpers.js";

const projectRoot = join("/", "project");
const worktree = join("/", "work", "main");

describe("createLinkedSymlinks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: nothing exists at the link path.
    fs.lstat.mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );
    fs.rm.mockResolvedValue(undefined);
  });

  it("uses a junction for directories", async () => {
    fs.stat.mockResolvedValue({ isDirectory: () => true });

    await createLinkedSymlinks(projectRoot, [worktree], "shared");

    expect(fs.symlink).toHaveBeenCalledWith(
      expect.any(String),
      join(worktree, "shared"),
      "junction",
    );
    expect(fs.link).not.toHaveBeenCalled();
  });

  it("uses a file symlink for files", async () => {
    fs.stat.mockResolvedValue({ isDirectory: () => false });

    await createLinkedSymlinks(projectRoot, [worktree], "AGENTS.md");

    expect(fs.symlink).toHaveBeenCalledWith(
      expect.any(String),
      join(worktree, "AGENTS.md"),
      "file",
    );
    expect(fs.link).not.toHaveBeenCalled();
  });

  it("falls back to a hard link when the file symlink gets EPERM", async () => {
    fs.stat.mockResolvedValue({ isDirectory: () => false });
    fs.symlink.mockRejectedValue(
      Object.assign(new Error("EPERM: operation not permitted"), {
        code: "EPERM",
      }),
    );

    await createLinkedSymlinks(projectRoot, [worktree], "AGENTS.md");

    expect(fs.link).toHaveBeenCalledWith(
      join(projectRoot, "AGENTS.md"),
      join(worktree, "AGENTS.md"),
    );
  });

  it("rethrows non-EPERM symlink errors", async () => {
    fs.stat.mockResolvedValue({ isDirectory: () => false });
    fs.symlink.mockRejectedValue(
      Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" }),
    );

    await expect(
      createLinkedSymlinks(projectRoot, [worktree], "AGENTS.md"),
    ).rejects.toThrow("ENOENT");
    expect(fs.link).not.toHaveBeenCalled();
  });

  it("skips a link that already points at the right target", async () => {
    fs.stat.mockResolvedValue({ isDirectory: () => true });
    fs.lstat.mockResolvedValue({ isSymbolicLink: () => true });
    fs.readlink.mockResolvedValue(join("..", "..", "project", "shared"));

    await createLinkedSymlinks(projectRoot, [worktree], "shared");

    expect(fs.symlink).not.toHaveBeenCalled();
    expect(fs.rename).not.toHaveBeenCalled();
    expect(fs.rm).not.toHaveBeenCalled();
  });

  it("refuses to replace a real directory", async () => {
    fs.stat.mockResolvedValue({ isDirectory: () => true });
    fs.lstat.mockResolvedValue({
      isSymbolicLink: () => false,
      isDirectory: () => true,
    });

    await expect(
      createLinkedSymlinks(projectRoot, [worktree], "shared"),
    ).rejects.toThrow("Refusing to replace real directory");
    expect(fs.symlink).not.toHaveBeenCalled();
    expect(fs.rm).not.toHaveBeenCalled();
  });

  it("refuses to replace a real file", async () => {
    fs.stat.mockResolvedValue({ isDirectory: () => false });
    fs.lstat.mockResolvedValue({
      isSymbolicLink: () => false,
      isDirectory: () => false,
    });

    await expect(
      createLinkedSymlinks(projectRoot, [worktree], "AGENTS.md"),
    ).rejects.toThrow("Refusing to replace real file");
    expect(fs.symlink).not.toHaveBeenCalled();
    expect(fs.rm).not.toHaveBeenCalled();
  });

  it("replaces a stale link and removes the backup", async () => {
    fs.stat.mockResolvedValue({ isDirectory: () => true });
    fs.lstat.mockResolvedValue({ isSymbolicLink: () => true });
    fs.readlink.mockResolvedValue("stale-target");

    await createLinkedSymlinks(projectRoot, [worktree], "shared");

    expect(fs.rename).toHaveBeenCalledWith(
      join(worktree, "shared"),
      expect.stringMatching(/\.bwt-[0-9a-f]{8}\.bak$/),
    );
    expect(fs.symlink).toHaveBeenCalled();
    const backup = fs.rename.mock.calls[0]?.[1] as string;
    expect(fs.rm).toHaveBeenCalledWith(backup, { force: true });
  });

  it("restores the previous link when replacement fails", async () => {
    fs.stat.mockResolvedValue({ isDirectory: () => true });
    fs.lstat.mockResolvedValue({ isSymbolicLink: () => true });
    fs.readlink.mockResolvedValue("stale-target");
    fs.symlink.mockRejectedValue(
      Object.assign(new Error("EIO: i/o error"), { code: "EIO" }),
    );

    await expect(
      createLinkedSymlinks(projectRoot, [worktree], "shared"),
    ).rejects.toThrow("EIO");

    const backup = fs.rename.mock.calls[0]?.[1] as string;
    expect(fs.rename).toHaveBeenLastCalledWith(
      backup,
      join(worktree, "shared"),
    );
  });
});
