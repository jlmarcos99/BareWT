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

    const lines: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk) => {
      lines.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    };

    const cmd = new ListCommand();
    await cmd.execute(fixture.bareDir);

    process.stdout.write = origWrite;

    const output = lines.join("");
    expect(output).toContain("main");
    expect(output).toContain("feature/login");
    expect(output).toContain("work/main");
    expect(output).toContain("work/feature/login");
  });

  it("throws when not in a bare repository", async () => {
    fixture = await createFixtureRepo();

    const cmd = new ListCommand();
    await expect(cmd.execute(fixture.workDir)).rejects.toThrow(
      "not a bare repository",
    );
  });
});
