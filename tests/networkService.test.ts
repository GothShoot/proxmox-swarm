import { describe, it, expect, vi } from 'vitest';
import { NetworkService } from '../src/services/networkService';

describe('NetworkService', () => {
  it('attaches without tags or vlan', () => {
    const run = vi.fn().mockReturnValue(0);
    const svc = new NetworkService({ run } as any);
    const auth = { host: 'h' };
    const status = svc.attachToSDN(auth, '100', 'net');
    expect(status).toBe(0);
    expect(run).toHaveBeenCalledWith('sdn', ['attach', '100', 'net'], auth);
  });

  it('attaches with tags and vlan', () => {
    const run = vi.fn().mockReturnValue(0);
    const svc = new NetworkService({ run } as any);
    const auth = {};
    svc.attachToSDN(auth, '101', 'net', ['a', 'b'], 5);
    expect(run).toHaveBeenCalledWith('sdn', ['attach', '101', 'net', '--tags', 'a,b', '--vlan', '5'], auth);
  });
});
