import { Command } from 'commander';
import { spawnSync } from 'child_process';

const program = new Command();

program
  .name('proxmox-swarm')
  .description('Proxmox CLI wrapper')
  .option('--host <host>', 'Proxmox host')
  .option('--user <user>', 'Proxmox user')
  .option('--password <password>', 'Proxmox password');

function runProxmox(cmd: string, args: string[]): void {
  const opts = program.opts();
  const env = {
    ...process.env,
    PROXMOX_HOST: opts.host,
    PROXMOX_USER: opts.user,
    PROXMOX_PASSWORD: opts.password,
  } as NodeJS.ProcessEnv;

  const result = spawnSync('proxmox', [cmd, ...args], {
    stdio: 'inherit',
    env,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(result.status ?? 1);
  }

  process.exit(result.status ?? 0);
}

program
  .command('deploy')
  .description('Deploy a new VM (placeholder).')
  .action(() => {
    runProxmox('deploy', []);
  });

program
  .command('start <vmid>')
  .description('Start an existing VM.')
  .action((vmid: string) => {
    runProxmox('start', [vmid]);
  });

program
  .command('stop <vmid>')
  .description('Stop a running VM.')
  .action((vmid: string) => {
    runProxmox('stop', [vmid]);
  });

program.parse();
