import { mkdirSync, rmSync } from "node:fs";
import { lstat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execa } from "execa";
import { afterEach, describe, expect, it } from "vitest";
import { LinkCommand } from "../../src/core/link.js";
import { UnlinkCommand } from "../../src/core/unlink.js";
import type { FixtureRepo } from "../helpers/fixtures.js";
import { createFixtureRepo } from "../helpers/fixtures.js";

describe("UnlinkCommand", () => {
  let fixture: FixtureRepo;

  afterEach(() => {
    if (fixture) {
      rmSync(dirname(fixture.bareDir), { recursive: true, force: true });
    }
  });

  it("removes the symlink from all worktrees", async () => {
    fixture = await createFixtureRepo();

    const projectRoot = dirname(fixture.bareDir);
    mkdirSync(join(projectRoot, "shared"), { recursive: true });

    const linkCmd = new LinkCommand();
    await linkCmd.execute(fixture.bareDir, "shared");

    const unlinkCmd = new UnlinkCommand();
    await unlinkCmd.execute(fixture.bareDir, "shared");

    const linkPath = join(fixture.workDir, "main", "shared");
    await expect(lstat(linkPath)).rejects.toThrow();
  });

  it("removes the path from git config", async () => {
    fixture = await createFixtureRepo();

    const projectRoot = dirname(fixture.bareDir);
    mkdirSync(join(projectRoot, "shared"), { recursive: true });

    const linkCmd = new LinkCommand();
    await linkCmd.execute(fixture.bareDir, "shared");

    const unlinkCmd = new UnlinkCommand();
    await unlinkCmd.execute(fixture.bareDir, "shared");

    const { stdout } = await execa(
      "git",
      ["-C", fixture.bareDir, "config", "--get-all", "bwt.linked"],
      { reject: false },
    );
    expect(stdout.trim()).toBe("");
  });
});
