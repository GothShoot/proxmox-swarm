import { describe, it, expect, vi } from 'vitest';

vi.mock('child_process', () => ({
  spawnSync: vi.fn(() => ({ status: 0 }))
}));

import { ProxmoxClient } from '../src/adapters/proxmoxClient';
import { spawnSync } from 'child_process';

describe('ProxmoxClient', () => {
  it('runs lws with provided auth', () => {
    const client = new ProxmoxClient();
    const auth = { host: 'h', user: 'u', password: 'p' };
    const opts = { ports: ['80:80'], environment: { NODE_ENV: 'prod' } };
    const status = client.run('cmd', ['arg'], auth, opts);
    expect(status).toBe(0);
    const lwsPath = require('path').resolve(process.cwd(), 'lws', 'lws.py');
    expect(spawnSync).toHaveBeenCalledWith(
      'python3',
      [lwsPath, 'cmd', 'arg', '-p', '80:80', '-e', 'NODE_ENV=prod'],
      expect.objectContaining({
        stdio: 'inherit',
        env: expect.objectContaining({
          LWS_HOST: 'h',
          LWS_USER: 'u',
          LWS_PASSWORD: 'p'
        })
      })
    );
  });

  it('returns error status when spawnSync fails', () => {
    (spawnSync as any).mockReturnValueOnce({ error: new Error('fail'), status: null });
    const client = new ProxmoxClient();
    const status = client.run('cmd', [], {});
    expect(status).toBe(1);
  });

  it('propagates non-zero exit status', () => {
    (spawnSync as any).mockReturnValueOnce({ status: 2 });
    const client = new ProxmoxClient();
    const status = client.run('cmd', [], {});
    expect(status).toBe(2);
  });
});
