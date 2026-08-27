const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INTERVAL_MS = 80;

export interface Spinner {
  succeed(text?: string): void;
  fail(text?: string): void;
  stop(): void;
}

export function createSpinner(text: string): Spinner {
  // Only animate on a TTY; otherwise stay silent to keep output parseable.
  if (!process.stderr.isTTY) {
    return { succeed: () => {}, fail: () => {}, stop: () => {} };
  }

  let frame = 0;
  const stream = process.stderr;
  const render = () => {
    stream.write(`\r${FRAMES[frame]} ${text}`);
    frame = (frame + 1) % FRAMES.length;
  };

  render();
  const timer = setInterval(render, INTERVAL_MS);

  let active = true;
  const finish = (line?: string) => {
    if (!active) return;
    active = false;
    clearInterval(timer);
    stream.write(`\r\x1b[K`);
    if (line) stream.write(`${line}\n`);
  };

  return {
    succeed: (text) => finish(text ? `✔ ${text}` : undefined),
    fail: (text) => finish(text ? `✖ ${text}` : undefined),
    stop: () => finish(),
  };
}
