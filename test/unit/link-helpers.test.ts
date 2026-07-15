import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  link: vi.fn(),
  mkdir: vi.fn(),
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
});
