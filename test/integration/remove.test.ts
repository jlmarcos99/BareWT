import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execa } from "execa";
import { afterEach, describe, expect, it } from "vitest";
import { RemoveCommand } from "../../src/core/remove.js";
import { directoryExists } from "../../src/utils/file-system.js";
import type { FixtureRepo } from "../helpers/fixtures.js";
import { createFixtureRepo } from "../helpers/fixtures.js";

describe("RemoveCommand", () => {
  let fixture: FixtureRepo;

  afterEach(() => {
    if (fixture) {
      rmSync(dirname(fixture.bareDir), { recursive: true, force: true });
    }
  });

  it("removes an existing worktree", async () => {
    fixture = await createFixtureRepo();

    const cmd = new RemoveCommand();
    await cmd.execute(fixture.bareDir, { branch: "main" });

    const output = await execa("git", [
      "-C",
      fixture.bareDir,
      "worktree",
      "list",
      "--porcelain",
    ]);
    expect(output.stdout).not.toContain("refs/heads/main");
  });

  it("cleans up empty parent directories after removal", async () => {
    fixture = await createFixtureRepo();

    const cmd = new RemoveCommand();
    await cmd.execute(fixture.bareDir, { branch: "feature/login" });

    const parentDir = join(fixture.workDir, "feature");
    expect(await directoryExists(parentDir)).toBe(false);
  });

  it("throws when the worktree is not found", async () => {
    fixture = await createFixtureRepo();

    const cmd = new RemoveCommand();
    await expect(
      cmd.execute(fixture.bareDir, { branch: "nonexistent" }),
    ).rejects.toThrow("no worktree found");
  });

  it("throws when not in a bare repository", async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "bwt-test-")));

    const cmd = new RemoveCommand();
    await expect(cmd.execute(base, { branch: "main" })).rejects.toThrow(
      "not a bare repository",
    );

    rmSync(base, { recursive: true, force: true });
  });

  it("removes worktree with --force even if dirty", async () => {
    fixture = await createFixtureRepo();

    const dirtyFile = join(fixture.workDir, "main", "dirty.txt");
    await execa("touch", [dirtyFile]);

    const cmd = new RemoveCommand();
    await cmd.execute(fixture.bareDir, { branch: "main", force: true });

    expect(await directoryExists(join(fixture.workDir, "main"))).toBe(false);
  });
});
