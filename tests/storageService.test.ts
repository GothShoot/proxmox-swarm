import { describe, it, expect, vi } from 'vitest';
import { StorageService } from '../src/services/storageService';

describe('StorageService', () => {
  it('creates subvolume with allowed options', () => {
    const run = vi.fn().mockReturnValue(0);
    const svc = new StorageService({ run } as any);
    const auth = {};
    const status = svc.createSubvolume(auth, 'subvol', { size: '1G', invalid: 'x' } as any);
    expect(status).toBe(0);
    expect(run).toHaveBeenCalledWith('cephfs', ['subvolume', 'create', 'subvol', '--size', '1G'], auth);
  });

  it('mounts with mode and options', () => {
    const run = vi.fn().mockReturnValue(0);
    const svc = new StorageService({ run } as any);
    const auth = {};
    const status = svc.mount(auth, '101', '/data', 'subvol', 'rw', { uid: '1000', bad: 'x' } as any);
    expect(status).toBe(0);
    expect(run).toHaveBeenCalledWith(
      'cephfs',
      ['mount', '101', '/data', 'subvol', '--mode', 'rw', '--uid', '1000'],
      auth
    );
  });

  it('unmounts with options', () => {
    const run = vi.fn().mockReturnValue(0);
    const svc = new StorageService({ run } as any);
    const auth = {};
    const status = svc.unmount(auth, '101', '/data', { force: '1', bad: 'x' } as any);
    expect(status).toBe(0);
    expect(run).toHaveBeenCalledWith(
      'cephfs',
      ['umount', '101', '/data', '--force', '1'],
      auth
    );
  });

  it('removes subvolume with options', () => {
    const run = vi.fn().mockReturnValue(0);
    const svc = new StorageService({ run } as any);
    const auth = {};
    const status = svc.removeSubvolume(auth, 'subvol', { force: '1', bad: 'x' } as any);
    expect(status).toBe(0);
    expect(run).toHaveBeenCalledWith(
      'cephfs',
      ['subvolume', 'rm', 'subvol', '--force', '1'],
      auth
    );
  });
});
