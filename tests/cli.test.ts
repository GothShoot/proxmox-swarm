import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

vi.mock('../src/core/logger', () => ({
  createLogger: () => ({ info: () => {}, error: () => {} }),
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({ unref: () => {} })),
}));

describe('cli daemon start', () => {
  let runtime: string;
  let pidFile: string;

  beforeAll(async () => {
    runtime = fs.mkdtempSync(join(tmpdir(), 'runtime-'));
    process.env.XDG_RUNTIME_DIR = runtime;
    ({ pidFile } = await import('../src/core/runtime'));
  });

  afterAll(() => {
    fs.rmSync(runtime, { recursive: true, force: true });
  });

  it('does not block the event loop while waiting for pid file', async () => {
    const { startDaemon } = await import('../src/commands/cli');
    let fired = false;
    setTimeout(() => {
      fired = true;
      fs.writeFileSync(pidFile, String(process.pid));
    }, 50);
    await startDaemon();
    expect(fired).toBe(true);
  });
});

