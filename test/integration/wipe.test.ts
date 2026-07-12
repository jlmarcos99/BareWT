import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execa } from "execa";
import { afterEach, describe, expect, it } from "vitest";
import { WipeCommand } from "../../src/core/wipe.js";
import { createFixtureRepo } from "../helpers/fixtures.js";

describe("WipeCommand", () => {
  let cleanupDir: string | undefined;

  afterEach(() => {
    if (cleanupDir) {
      rmSync(cleanupDir, { recursive: true, force: true });
      cleanupDir = undefined;
    }
  });

  it("throws when not in a bare repository", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));
    cleanupDir = base;

    const cmd = new WipeCommand();
    await expect(cmd.execute(base)).rejects.toThrow("not a bare repository");
  });

  it("shows message when no worktrees to clean", async () => {
    const fixture = await createFixtureRepo();
    cleanupDir = dirname(fixture.bareDir);

    await execa("git", [
      "-C",
      fixture.bareDir,
      "worktree",
      "remove",
      join(fixture.workDir, "feature", "login"),
    ]);

    const lines: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk) => {
      const str = typeof chunk === "string" ? chunk : chunk.toString();
      lines.push(str);
      return true;
    };

    try {
      const cmd = new WipeCommand();
      await cmd.execute(fixture.bareDir);
    } finally {
      process.stdout.write = orig;
    }

    expect(lines.some((l) => l.includes("No worktrees"))).toBe(true);
  });
});
