import { describe, it, expect, vi } from 'vitest';

vi.mock('child_process', () => ({
  spawnSync: vi.fn(() => ({ status: 0 }))
}));

import { ProxmoxClient } from '../src/adapters/proxmoxClient';
import { spawnSync } from 'child_process';

describe('ProxmoxClient', () => {
  it('runs proxmox with provided auth', () => {
    const client = new ProxmoxClient();
    const auth = { host: 'h', user: 'u', password: 'p' };
    const opts = { ports: ['80:80'], environment: { NODE_ENV: 'prod' } };
    const status = client.run('cmd', ['arg'], auth, opts);
    expect(status).toBe(0);
    expect(spawnSync).toHaveBeenCalledWith(
      'proxmox',
      ['cmd', 'arg', '-p', '80:80', '-e', 'NODE_ENV=prod'],
      expect.objectContaining({
        stdio: 'inherit',
        env: expect.objectContaining({
          PROXMOX_HOST: 'h',
          PROXMOX_USER: 'u',
          PROXMOX_PASSWORD: 'p'
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
});
