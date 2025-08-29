import { Command } from 'commander';
import { runProxmox, ProxmoxAuth } from './proxmox';
import { parseCompose } from './composeParser';
import { attachToSDN } from './sdn';

const program = new Command();

const allowedSubvolumeOptions = new Set(['size', 'mode', 'uid', 'gid', 'quota']);
const allowedMountOptions = new Set(['uid', 'gid', 'rw', 'ro', 'quota']);

function buildOptionArgs(
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

program
  .name('proxmox-swarm')
  .description('Proxmox CLI wrapper')
  .option('--host <host>', 'Proxmox host')
  .option('--user <user>', 'Proxmox user')
  .option('--password <password>', 'Proxmox password')
  .option('--sdn-network <network>', 'SDN overlay network to attach LXCs')
  .option('--create-sdn', 'Create SDN network if missing');

function getAuth(): ProxmoxAuth {
  const opts = program.opts();
  return {
    host: opts.host,
    user: opts.user,
    password: opts.password,
  };
}

program
  .command('deploy <compose>')
  .description('Deploy LXC containers defined in a compose file.')
  .action((compose: string) => {
    const { services, volumes } = parseCompose(compose);
    const opts = program.opts();
    const auth = getAuth();
    if (opts.sdnNetwork && opts.createSdn) {
      const netStatus = runProxmox('sdn', ['create', opts.sdnNetwork], auth);
      if (netStatus !== 0) {
        process.exit(netStatus);
      }
    }
    for (const volDef of Object.values(volumes)) {
      if (volDef.external) {
        continue;
      }
      const args = ['subvolume', 'create', volDef.subvolume];
      args.push(...buildOptionArgs(volDef.options, allowedSubvolumeOptions));
      const volStatus = runProxmox('cephfs', args, auth);
      if (volStatus !== 0) {
        process.exit(volStatus);
      }
    }
    for (const [name, cfg] of Object.entries(services)) {
      const status = runProxmox('deploy', [name, cfg.image], auth);
      if (status !== 0) {
        process.exit(status);
      }
      if (opts.sdnNetwork) {
        const sdnStatus = attachToSDN(auth, name, opts.sdnNetwork, cfg.tags, cfg.vlan);
        if (sdnStatus !== 0) {
          process.exit(sdnStatus);
        }
      }
      for (const mount of cfg.volumes) {
        const def = volumes[mount.volume];
        if (!def) {
          console.warn(`Volume ${mount.volume} not defined in compose file`);
          continue;
        }
        const mArgs = ['mount', name, mount.target, def.subvolume];
        if (mount.mode) {
          mArgs.push('--mode', mount.mode);
        }
        mArgs.push(...buildOptionArgs(def.options, allowedMountOptions));
        const mStatus = runProxmox('cephfs', mArgs, auth);
        if (mStatus !== 0) {
          process.exit(mStatus);
        }
      }
    }
  });

program
  .command('start <vmid>')
  .description('Start an existing VM.')
  .action((vmid: string) => {
    const status = runProxmox('start', [vmid], getAuth());
    process.exit(status);
  });

program
  .command('stop <vmid>')
  .description('Stop a running VM.')
  .action((vmid: string) => {
    const status = runProxmox('stop', [vmid], getAuth());
    process.exit(status);
  });

program.parse();
