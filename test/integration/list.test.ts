import { rmSync } from "node:fs";
import { dirname } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ListCommand } from "../../src/core/list.js";
import type { FixtureRepo } from "../helpers/fixtures.js";
import { createFixtureRepo } from "../helpers/fixtures.js";

describe("ListCommand", () => {
  let fixture: FixtureRepo;

  afterEach(() => {
    if (fixture) {
      rmSync(dirname(fixture.bareDir), { recursive: true, force: true });
    }
  });

  it("lists all worktrees with branch, sha, and path", async () => {
    fixture = await createFixtureRepo();

    const cmd = new ListCommand();
    const lines = await cmd.execute(fixture.bareDir);

    const output = lines.join("");
    expect(output).toContain("main");
    expect(output).toContain("feature/login");
    expect(output).toContain("work/main");
    expect(output).toContain("work/feature/login");
  });

  it("--protected shows only protected worktrees", async () => {
    fixture = await createFixtureRepo();

    const cmd = new ListCommand();
    const lines = await cmd.execute(fixture.bareDir, { protected: true });

    const output = lines.join("");
    expect(output).toContain("main");
    expect(output).not.toContain("feature/login");
  });

  it("--unprotected shows only unprotected worktrees", async () => {
    fixture = await createFixtureRepo();

    const cmd = new ListCommand();
    const lines = await cmd.execute(fixture.bareDir, { unprotected: true });

    const output = lines.join("");
    expect(output).not.toContain("main");
    expect(output).toContain("feature/login");
  });

  it("throws when not in a bare repository", async () => {
    fixture = await createFixtureRepo();

    const cmd = new ListCommand();
    await expect(cmd.execute(fixture.workDir)).rejects.toThrow(
      "not a bare repository",
    );
  });
});
