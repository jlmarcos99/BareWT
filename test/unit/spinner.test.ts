import { afterEach, describe, expect, it, vi } from "vitest";
import { createSpinner } from "../../src/utils/spinner.js";

function setIsTTY(value: boolean): void {
  Object.defineProperty(process.stderr, "isTTY", {
    value,
    configurable: true,
  });
}

describe("createSpinner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    setIsTTY(false);
  });

  it("is a no-op when stderr is not a TTY", () => {
    const writeSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    setIsTTY(false);

    const spinner = createSpinner("working…");
    spinner.succeed("done");
    spinner.fail("oops");
    spinner.stop();

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("animates frames while active and clears the line on succeed", () => {
    vi.useFakeTimers();
    const writeSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    setIsTTY(true);

    const spinner = createSpinner("working…");
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining("working…"));

    vi.advanceTimersByTime(160);
    const frameCalls = writeSpy.mock.calls.filter(([arg]) =>
      String(arg).startsWith("\r"),
    );
    expect(frameCalls.length).toBeGreaterThan(1);

    spinner.succeed("done");
    const last = String(writeSpy.mock.calls.at(-1)?.[0]);
    expect(last).toContain("✔ done");
  });

  it("writes a failure mark on fail and stops the timer", () => {
    vi.useFakeTimers();
    const writeSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    setIsTTY(true);

    const spinner = createSpinner("working…");
    spinner.fail("broken");
    writeSpy.mockClear();

    vi.advanceTimersByTime(500);
    expect(writeSpy).not.toHaveBeenCalled();
  });
});
