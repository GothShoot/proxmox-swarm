import { IProxmoxClient, ProxmoxAuth } from '../adapters/proxmoxClient';

export interface INetworkService {
  attachToSDN(
    auth: ProxmoxAuth,
    vmid: string,
    network: string,
    tags?: string[],
    vlan?: number
  ): number;
  detachFromSDN(auth: ProxmoxAuth, vmid: string, network: string): number;
  createNetwork(
    auth: ProxmoxAuth,
    name: string,
    zone?: string,
    vlan?: number
  ): number;
  deleteNetwork(auth: ProxmoxAuth, name: string): number;
  configureInterface(
    auth: ProxmoxAuth,
    iface: string,
    ip?: string,
    mtu?: number,
    acls?: string[]
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
    return this.proxmox.sdn(args, auth);
  }

  detachFromSDN(auth: ProxmoxAuth, vmid: string, network: string): number {
    return this.proxmox.sdn(['detach', vmid, network], auth);
  }

  createNetwork(
    auth: ProxmoxAuth,
    name: string,
    zone?: string,
    vlan?: number
  ): number {
    const args = ['create', name];
    if (zone !== undefined) {
      args.push('--zone', zone);
    }
    if (vlan !== undefined) {
      args.push('--vlan', String(vlan));
    }
    return this.proxmox.sdn(args, auth);
  }

  deleteNetwork(auth: ProxmoxAuth, name: string): number {
    return this.proxmox.sdn(['delete', name], auth);
  }

  configureInterface(
    auth: ProxmoxAuth,
    iface: string,
    ip?: string,
    mtu?: number,
    acls?: string[]
  ): number {
    const args = ['iface', iface];
    if (ip !== undefined) {
      args.push('--ip', ip);
    }
    if (mtu !== undefined) {
      args.push('--mtu', String(mtu));
    }
    if (acls && acls.length) {
      args.push('--acl', acls.join(','));
    }
    return this.proxmox.sdn(args, auth);
  }
}

