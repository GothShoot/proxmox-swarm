import { IProxmoxClient, ProxmoxAuth } from '../adapters/proxmoxClient';

export interface INetworkService {
  attachToSDN(
    auth: ProxmoxAuth,
    vmid: string,
    network: string,
    tags?: string[],
    vlan?: number
  ): number;
}

export class NetworkService implements INetworkService {
  constructor(private proxmox: IProxmoxClient) {}

  attachToSDN(
    auth: ProxmoxAuth,
    vmid: string,
    network: string,
    tags?: string[],
    vlan?: number
  ): number {
    const args = ['attach', vmid, network];
    if (tags && tags.length) {
      args.push('--tags', tags.join(','));
    }
    if (vlan !== undefined) {
      args.push('--vlan', String(vlan));
    }
    return this.proxmox.run('sdn', args, auth);
  }
}

