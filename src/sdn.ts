import { runProxmox, ProxmoxAuth } from './proxmox';

export function attachToSDN(
  auth: ProxmoxAuth,
  vmid: string,
  network: string,
  tags?: string[],
  vlan?: number,
  create?: boolean
): void {
  if (create) {
    runProxmox('sdn', ['create', network], auth);
  }
  const args = ['attach', vmid, network];
  if (tags && tags.length) {
    args.push('--tags', tags.join(','));
  }
  if (vlan !== undefined) {
    args.push('--vlan', String(vlan));
  }
  runProxmox('sdn', args, auth);
}
