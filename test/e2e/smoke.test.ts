import { execa } from "execa";
import { describe, expect, it } from "vitest";

describe("bwt --version", () => {
  it("prints the version and exits 0", async () => {
    const { stdout, exitCode } = await execa(
      "node",
      ["./dist/main.js", "--version"],
      { reject: false },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe("bwt --help", () => {
  it("prints help and exits 0", async () => {
    const { stdout, exitCode } = await execa(
      "node",
      ["./dist/main.js", "--help"],
      { reject: false },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("bwt");
    expect(stdout).toContain("bare clone");
  });
});
