import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import http from 'http';

const runMock = vi.fn(() => 0);
vi.mock('../src/adapters/proxmoxClient', () => ({
  ProxmoxClient: vi.fn().mockImplementation(() => ({ run: runMock }))
}));

vi.mock('../src/services/networkService', () => ({
  NetworkService: vi.fn().mockImplementation(() => ({ attachToSDN: vi.fn(() => 0) }))
}));

vi.mock('../src/services/storageService', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    createSubvolume: vi.fn(() => 0),
    mount: vi.fn(() => 0)
  }))
}));

vi.mock('../src/core/logger', () => ({
  createLogger: () => ({ info: () => {}, error: () => {}, warn: () => {} })
}));

describe('daemon deploy', () => {
  let socketPath: string;
  let server: any;

  beforeAll(async () => {
    const runtime = fs.mkdtempSync(join(tmpdir(), 'runtime-'));
    process.env.XDG_RUNTIME_DIR = runtime;
    process.env.SWARM_LOG_FILE = join(runtime, 'daemon.log');
    process.env.SWARM_LOG_INTERVAL = 'daily';
    ({ socketFile: socketPath } = await import('../src/core/runtime'));
    ({ server } = await import('../src/core/daemon'));
  });

  afterAll(() => {
    server.close();
    if (process.env.XDG_RUNTIME_DIR) {
      fs.rmSync(process.env.XDG_RUNTIME_DIR, { recursive: true, force: true });
    }
  });

  it('creates multiple containers and passes options', async () => {
    const yaml = `services:\n  app:\n    image: img\n    ports: ['80:80']\n    environment:\n      NODE_ENV: test\n    deploy:\n      replicas: 2\nvolumes: {}`;
    const dir = fs.mkdtempSync(join(tmpdir(), 'compose-'));
    const file = join(dir, 'compose.yml');
    fs.writeFileSync(file, yaml);
    const body = JSON.stringify({ compose: file });

    await new Promise<void>((resolve) => {
      const req = http.request({
        socketPath,
        path: '/deploy',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      });
      req.write(body);
      req.end();
    });

    expect(runMock).toHaveBeenCalledTimes(2);
    for (const call of runMock.mock.calls) {
      expect(call[3]).toEqual({ ports: ['80:80'], environment: { NODE_ENV: 'test' } });
    }

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
