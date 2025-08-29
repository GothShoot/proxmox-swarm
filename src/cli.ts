import { Command } from 'commander';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ensureRuntimeDir, pidFile, logFile } from './runtime';
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

function sleep(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function startDaemon() {
  ensureRuntimeDir();
  if (fs.existsSync(pidFile)) {
    const existing = Number(fs.readFileSync(pidFile, 'utf8'));
    if (isRunning(existing)) {
      console.log(`Daemon already running (PID ${existing})`);
      return;
    }
    fs.unlinkSync(pidFile);
  }
  const daemonPath = path.resolve(__dirname, 'daemon', 'index.js');
  const out = fs.openSync(logFile, 'a');
  const err = fs.openSync(logFile, 'a');
  const child = spawn(process.execPath, [daemonPath], {
    detached: true,
    stdio: ['ignore', out, err],
  });
  child.unref();
  const start = Date.now();
  const timeout = 5000;
  while (!fs.existsSync(pidFile) && Date.now() - start < timeout) {
    sleep(100);
  }
  if (fs.existsSync(pidFile)) {
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    console.log(`Daemon started (PID ${pid})`);
  } else {
    console.error('Failed to start daemon');
  }
}

function stopDaemon() {
  if (!fs.existsSync(pidFile)) {
    console.log('Daemon not running');
    return;
  }
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  if (!isRunning(pid)) {
    console.log('Daemon not running');
    fs.unlinkSync(pidFile);
    return;
  }
  process.kill(pid);
  const start = Date.now();
  const timeout = 5000;
  while (isRunning(pid) && Date.now() - start < timeout) {
    sleep(100);
  }
  if (isRunning(pid)) {
    console.error('Failed to stop daemon');
    return;
  }
  fs.unlinkSync(pidFile);
  console.log('Daemon stopped');
}

function statusDaemon() {
  if (!fs.existsSync(pidFile)) {
    console.log('Daemon not running');
    return;
  }
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  if (isRunning(pid)) {
    console.log(`Daemon running (PID ${pid})`);
  } else {
    console.log('Daemon not running');
    fs.unlinkSync(pidFile);
  }
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

const daemonCmd = program.command('daemon').description('Control swarm daemon');
daemonCmd.command('start').action(startDaemon);
daemonCmd.command('stop').action(stopDaemon);
daemonCmd.command('status').action(statusDaemon);

program.parse();
