import { Command } from 'commander';
import { runProxmox, ProxmoxAuth } from './proxmox';
import { parseCompose } from './composeParser';
import { attachToSDN } from './sdn';

const program = new Command();

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
    const services = parseCompose(compose);
    const opts = program.opts();
    const auth = getAuth();
    if (opts.sdnNetwork && opts.createSdn) {
      const netStatus = runProxmox('sdn', ['create', opts.sdnNetwork], auth);
      if (netStatus !== 0) {
        process.exit(netStatus);
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
