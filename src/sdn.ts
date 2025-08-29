import { runProxmox, ProxmoxAuth } from './proxmox';

export function attachToSDN(
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
  return runProxmox('sdn', args, auth);
}
