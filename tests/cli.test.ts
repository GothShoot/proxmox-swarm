import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
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

  afterEach(() => {
    try {
      fs.unlinkSync(pidFile);
    } catch {}
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

  it('detects pid file created before watch is ready', async () => {
    vi.resetModules();
    vi.doMock('../src/core/logger', () => ({
      createLogger: () => ({ info: () => {}, error: () => {} }),
    }));
    vi.doMock('child_process', () => ({
      spawn: vi.fn(() => ({ unref: () => {} })),
    }));
    vi.doMock('fs/promises', async () => {
      const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
      return {
        ...actual,
        watch: (dir: string, opts: any) => {
          async function* generator() {
            await new Promise((r) => setTimeout(r, 20));
            const real = actual.watch(dir, opts);
            for await (const ev of real) {
              yield ev;
            }
          }
          return generator();
        },
      };
    });
    const { startDaemon } = await import('../src/commands/cli');
    setTimeout(() => {
      fs.writeFileSync(pidFile, String(process.pid));
    }, 5);
    await startDaemon();
    vi.unmock('fs/promises');
  });
});

