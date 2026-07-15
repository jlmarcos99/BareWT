import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { lstat, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execa } from "execa";
import { afterEach, describe, expect, it } from "vitest";
import { LinkCommand } from "../../src/core/link.js";
import type { FixtureRepo } from "../helpers/fixtures.js";
import { createFixtureRepo } from "../helpers/fixtures.js";

describe("LinkCommand", () => {
  let fixture: FixtureRepo;

  afterEach(() => {
    if (fixture) {
      rmSync(dirname(fixture.bareDir), { recursive: true, force: true });
    }
  });

  it("creates a symlink in existing worktrees", async () => {
    fixture = await createFixtureRepo();

    const projectRoot = dirname(fixture.bareDir);
    const sharedDir = join(projectRoot, "shared");
    mkdirSync(sharedDir, { recursive: true });
    writeFileSync(join(sharedDir, "notes.txt"), "hello");

    const cmd = new LinkCommand();
    await cmd.execute(fixture.bareDir, "shared");

    const linkPath = join(fixture.workDir, "main", "shared", "notes.txt");
    const content = readFileSync(linkPath, "utf-8").trim();
    expect(content).toBe("hello");
  });

  it("creates a symlink for a single file", async () => {
    fixture = await createFixtureRepo();

    const projectRoot = dirname(fixture.bareDir);
    writeFileSync(join(projectRoot, "AGENTS.md"), "# agents");

    const cmd = new LinkCommand();
    await cmd.execute(fixture.bareDir, "AGENTS.md");

    const linkPath = join(fixture.workDir, "main", "AGENTS.md");
    const stat = await lstat(linkPath);
    expect(stat.isSymbolicLink()).toBe(true);
    expect(readFileSync(linkPath, "utf-8")).toBe("# agents");
  });

  it("adds the path to info/exclude", async () => {
    fixture = await createFixtureRepo();

    const projectRoot = dirname(fixture.bareDir);
    const sharedDir = join(projectRoot, "shared");
    mkdirSync(sharedDir, { recursive: true });

    const cmd = new LinkCommand();
    await cmd.execute(fixture.bareDir, "shared");

    const excludePath = join(fixture.bareDir, "info", "exclude");
    const excludeContent = readFileSync(excludePath, "utf-8");
    expect(excludeContent).toContain("shared");
  });

  it("saves the path in git config", async () => {
    fixture = await createFixtureRepo();

    const projectRoot = dirname(fixture.bareDir);
    const sharedDir = join(projectRoot, "shared");
    mkdirSync(sharedDir, { recursive: true });

    const cmd = new LinkCommand();
    await cmd.execute(fixture.bareDir, "shared");

    const { stdout } = await execa("git", [
      "-C",
      fixture.bareDir,
      "config",
      "--get-all",
      "bwt.linked",
    ]);
    expect(stdout.trim()).toBe("shared");
  });

  it("throws if the path not found at", async () => {
    fixture = await createFixtureRepo();

    const cmd = new LinkCommand();
    await expect(cmd.execute(fixture.bareDir, "nonexistent")).rejects.toThrow(
      "not found at",
    );
  });

  it("--sync recreates deleted symlinks", async () => {
    fixture = await createFixtureRepo();

    const projectRoot = dirname(fixture.bareDir);
    mkdirSync(join(projectRoot, "shared"), { recursive: true });

    const cmd = new LinkCommand();
    await cmd.execute(fixture.bareDir, "shared");

    await rm(join(fixture.workDir, "main", "shared"), {
      recursive: true,
      force: true,
    });

    await cmd.execute(fixture.bareDir, "", true);

    const linkPath = join(fixture.workDir, "main", "shared");
    const stat = await lstat(linkPath);
    expect(stat.isSymbolicLink()).toBe(true);
  });

  it("throws when not in a bare repository", async () => {
    fixture = await createFixtureRepo();

    const cmd = new LinkCommand();
    await expect(cmd.execute(fixture.workDir, "shared")).rejects.toThrow(
      "not a bare repository",
    );
  });
});
