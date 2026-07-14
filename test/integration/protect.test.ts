import { rmSync } from "node:fs";
import { dirname } from "node:path";
import { execa } from "execa";
import { afterEach, describe, expect, it } from "vitest";
import { ProtectCommand } from "../../src/core/protect.js";
import { UnprotectCommand } from "../../src/core/unprotect.js";
import type { FixtureRepo } from "../helpers/fixtures.js";
import { createFixtureRepo } from "../helpers/fixtures.js";

describe("ProtectCommand", () => {
  let fixture: FixtureRepo;

  afterEach(() => {
    if (fixture) {
      rmSync(dirname(fixture.bareDir), { recursive: true, force: true });
    }
  });

  it("adds a branch to protected config", async () => {
    fixture = await createFixtureRepo();

    const cmd = new ProtectCommand();
    await cmd.execute(fixture.bareDir, "feature/login");

    const { stdout } = await execa("git", [
      "-C",
      fixture.bareDir,
      "config",
      "--get-all",
      "bwt.protected",
    ]);
    expect(stdout.trim()).toBe("feature/login");
  });

  it("throws if branch does not exist", async () => {
    fixture = await createFixtureRepo();

    const cmd = new ProtectCommand();
    await expect(cmd.execute(fixture.bareDir, "nonexistent")).rejects.toThrow(
      "does not exist",
    );
  });

  it("throws when not in a bare repository", async () => {
    fixture = await createFixtureRepo();

    const cmd = new ProtectCommand();
    await expect(cmd.execute(fixture.workDir, "main")).rejects.toThrow(
      "not a bare repository",
    );
  });
});

describe("UnprotectCommand", () => {
  let fixture: FixtureRepo;

  afterEach(() => {
    if (fixture) {
      rmSync(dirname(fixture.bareDir), { recursive: true, force: true });
    }
  });

  it("removes a branch from protected config", async () => {
    fixture = await createFixtureRepo();

    const protect = new ProtectCommand();
    await protect.execute(fixture.bareDir, "feature/login");

    const unprotect = new UnprotectCommand();
    await unprotect.execute(fixture.bareDir, "feature/login");

    const { stdout } = await execa(
      "git",
      ["-C", fixture.bareDir, "config", "--get-all", "bwt.protected"],
      { reject: false },
    );
    expect(stdout.trim()).toBe("");
  });
});
