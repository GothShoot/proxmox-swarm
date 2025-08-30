import { describe, it, expect, vi } from 'vitest';
import { NetworkService } from '../src/services/networkService';

describe('NetworkService', () => {
  it('attaches without tags or vlan', () => {
    const sdn = vi.fn().mockReturnValue(0);
    const svc = new NetworkService({ sdn } as any);
    const auth = { host: 'h' };
    const status = svc.attachToSDN(auth, '100', 'net');
    expect(status).toBe(0);
    expect(sdn).toHaveBeenCalledWith(['attach', '100', 'net'], auth);
  });

  it('attaches with tags and vlan', () => {
    const sdn = vi.fn().mockReturnValue(0);
    const svc = new NetworkService({ sdn } as any);
    const auth = {};
    svc.attachToSDN(auth, '101', 'net', ['a', 'b'], 5);
    expect(sdn).toHaveBeenCalledWith(
      ['attach', '101', 'net', '--tags', 'a,b', '--vlan', '5'],
      auth
    );
  });

  it('detaches from network', () => {
    const sdn = vi.fn().mockReturnValue(0);
    const svc = new NetworkService({ sdn } as any);
    const auth = {};
    svc.detachFromSDN(auth, '102', 'net');
    expect(sdn).toHaveBeenCalledWith(['detach', '102', 'net'], auth);
  });

  it('creates network with zone and vlan', () => {
    const sdn = vi.fn().mockReturnValue(0);
    const svc = new NetworkService({ sdn } as any);
    const auth = {};
    svc.createNetwork(auth, 'net', 'zone1', 10);
    expect(sdn).toHaveBeenCalledWith(
      ['create', 'net', '--zone', 'zone1', '--vlan', '10'],
      auth
    );
  });

  it('creates network with empty zone string', () => {
    const sdn = vi.fn().mockReturnValue(0);
    const svc = new NetworkService({ sdn } as any);
    const auth = {};
    svc.createNetwork(auth, 'net', '', 5);
    expect(sdn).toHaveBeenCalledWith(
      ['create', 'net', '--zone', '', '--vlan', '5'],
      auth
    );
  });

  it('throws error for invalid tag format', () => {
    const sdn = vi.fn();
    const svc = new NetworkService({ sdn } as any);
    const auth = {};
    expect(() => svc.attachToSDN(auth, '103', 'net', ['bad tag'])).toThrow(
      /Invalid tag format/
    );
    expect(sdn).not.toHaveBeenCalled();
  });

  it('throws error for vlan out of range', () => {
    const sdn = vi.fn();
    const svc = new NetworkService({ sdn } as any);
    const auth = {};
    expect(() => svc.createNetwork(auth, 'net', 'zone', 5000)).toThrow(
      /VLAN must be an integer between 1 and 4094/
    );
    expect(sdn).not.toHaveBeenCalled();
  });

  it('deletes network', () => {
    const sdn = vi.fn().mockReturnValue(0);
    const svc = new NetworkService({ sdn } as any);
    const auth = {};
    svc.deleteNetwork(auth, 'net');
    expect(sdn).toHaveBeenCalledWith(['delete', 'net'], auth);
  });

  it('configures interface', () => {
    const sdn = vi.fn().mockReturnValue(0);
    const svc = new NetworkService({ sdn } as any);
    const auth = {};
    svc.configureInterface(auth, 'eth0', '10.0.0.2/24', 1500, ['a', 'b']);
    expect(sdn).toHaveBeenCalledWith(
      ['iface', 'eth0', '--ip', '10.0.0.2/24', '--mtu', '1500', '--acl', 'a,b'],
      auth
    );
  });

  it('configures interface with empty ip string', () => {
    const sdn = vi.fn().mockReturnValue(0);
    const svc = new NetworkService({ sdn } as any);
    const auth = {};
    svc.configureInterface(auth, 'eth0', '');
    expect(sdn).toHaveBeenCalledWith(
      ['iface', 'eth0', '--ip', ''],
      auth
    );
  });

  it('propagates non-zero status from sdn operations', () => {
    const sdn = vi.fn().mockReturnValue(1);
    const svc = new NetworkService({ sdn } as any);
    const auth = {};

    expect(svc.attachToSDN(auth, '200', 'net')).toBe(1);
    expect(svc.detachFromSDN(auth, '200', 'net')).toBe(1);
    expect(svc.createNetwork(auth, 'net')).toBe(1);
    expect(svc.deleteNetwork(auth, 'net')).toBe(1);
    expect(svc.configureInterface(auth, 'eth0')).toBe(1);
  });
});
