import { describe, it, expect, vi } from 'vitest';
import { StorageService } from '../src/services/storageService';
import { NetworkService } from '../src/services/networkService';

describe('Integration workflow', () => {
  it('creates subvolume, mounts, attaches network, then cleans up', () => {
    const run = vi.fn().mockReturnValue(0);
    const sdn = vi.fn().mockReturnValue(0);
    const proxmox = { run, sdn } as any;
    const storage = new StorageService(proxmox);
    const network = new NetworkService(proxmox);
    const auth = {};

    expect(storage.createSubvolume(auth, 'sv')).toBe(0);
    expect(storage.mount(auth, '100', '/mnt', 'sv')).toBe(0);
    expect(network.attachToSDN(auth, '100', 'net')).toBe(0);
    expect(storage.unmount(auth, '100', '/mnt')).toBe(0);
    expect(network.detachFromSDN(auth, '100', 'net')).toBe(0);

    expect(run).toHaveBeenNthCalledWith(1, 'cephfs', ['subvolume', 'create', 'sv'], auth);
    expect(run).toHaveBeenNthCalledWith(2, 'cephfs', ['mount', '100', '/mnt', 'sv'], auth);
    expect(run).toHaveBeenNthCalledWith(3, 'cephfs', ['umount', '100', '/mnt'], auth);
    expect(sdn).toHaveBeenNthCalledWith(1, ['attach', '100', 'net'], auth);
    expect(sdn).toHaveBeenNthCalledWith(2, ['detach', '100', 'net'], auth);
  });
});
