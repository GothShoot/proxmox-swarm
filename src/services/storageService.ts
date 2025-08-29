import { IProxmoxClient, ProxmoxAuth } from '../adapters/proxmoxClient';

export interface IStorageService {
  createSubvolume(
    auth: ProxmoxAuth,
    subvolume: string,
    options?: Record<string, string>
  ): number;
  mount(
    auth: ProxmoxAuth,
    vmid: string,
    target: string,
    subvolume: string,
    mode?: string,
    options?: Record<string, string>
  ): number;
}

export class StorageService implements IStorageService {
  private readonly allowedSubvolumeOptions = new Set(['size', 'mode', 'uid', 'gid', 'quota']);
  private readonly allowedMountOptions = new Set(['uid', 'gid', 'rw', 'ro', 'quota']);

  constructor(private proxmox: IProxmoxClient) {}

  private buildOptionArgs(
    options: Record<string, string> | undefined,
    allowed: Set<string>
  ): string[] {
    const args: string[] = [];
    if (!options) return args;
    for (const [k, v] of Object.entries(options)) {
      if (allowed.has(k)) {
        args.push(`--${k}`, v);
      } else {
        console.warn(`Ignoring unsupported option ${k}`);
      }
    }
    return args;
  }

  createSubvolume(
    auth: ProxmoxAuth,
    subvolume: string,
    options?: Record<string, string>
  ): number {
    const args = ['subvolume', 'create', subvolume];
    args.push(...this.buildOptionArgs(options, this.allowedSubvolumeOptions));
    return this.proxmox.run('cephfs', args, auth);
  }

  mount(
    auth: ProxmoxAuth,
    vmid: string,
    target: string,
    subvolume: string,
    mode?: string,
    options?: Record<string, string>
  ): number {
    const args = ['mount', vmid, target, subvolume];
    if (mode) {
      args.push('--mode', mode);
    }
    args.push(...this.buildOptionArgs(options, this.allowedMountOptions));
    return this.proxmox.run('cephfs', args, auth);
  }
}

