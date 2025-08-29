import { Command } from 'commander';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ensureRuntimeDir, pidFile } from '../core/runtime';
import { ProxmoxAuth } from '../adapters/proxmoxClient';
import { DaemonClient } from '../client/daemonClient';
import { createLogger } from '../core/logger';

const program = new Command();

const client = new DaemonClient();
const logger = createLogger();

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
      logger.info(`Daemon already running (PID ${existing})`);
      return;
    }
    fs.unlinkSync(pidFile);
  }
  const daemonPath = path.resolve(__dirname, '..', 'core', 'daemon.js');
  const child = spawn(process.execPath, [daemonPath], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  const start = Date.now();
  const timeout = 5000;
  while (!fs.existsSync(pidFile) && Date.now() - start < timeout) {
    sleep(100);
  }
  if (fs.existsSync(pidFile)) {
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    logger.info(`Daemon started (PID ${pid})`);
  } else {
    logger.error('Failed to start daemon');
  }
}

function stopDaemon() {
  if (!fs.existsSync(pidFile)) {
    logger.info('Daemon not running');
    return;
  }
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  if (!isRunning(pid)) {
    logger.info('Daemon not running');
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
    logger.error('Failed to stop daemon');
    return;
  }
  fs.unlinkSync(pidFile);
  logger.info('Daemon stopped');
}

function statusDaemon() {
  if (!fs.existsSync(pidFile)) {
    logger.info('Daemon not running');
    return;
  }
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  if (isRunning(pid)) {
    logger.info(`Daemon running (PID ${pid})`);
  } else {
    logger.info('Daemon not running');
    fs.unlinkSync(pidFile);
  }
}

program
  .command('deploy <compose>')
  .description('Deploy LXC containers defined in a compose file.')
  .action(async (compose: string) => {
    try {
      const opts = program.opts();
      const auth = getAuth();
      const result = await client.deploy(compose, auth, opts.sdnNetwork, opts.createSdn);
      process.exit(result.status ?? 0);
    } catch (e) {
      logger.error((e as Error).message);
      process.exit(1);
    }
  });

program
  .command('start <vmid>')
  .description('Start an existing VM.')
  .action(async (vmid: string) => {
    try {
      const result = await client.start(vmid, getAuth());
      process.exit(result.status ?? 0);
    } catch (e) {
      logger.error((e as Error).message);
      process.exit(1);
    }
  });

program
  .command('stop <vmid>')
  .description('Stop a running VM.')
  .action(async (vmid: string) => {
    try {
      const result = await client.stop(vmid, getAuth());
      process.exit(result.status ?? 0);
    } catch (e) {
      logger.error((e as Error).message);
      process.exit(1);
    }
  });

const daemonCmd = program.command('daemon').description('Control swarm daemon');
daemonCmd.command('start').action(startDaemon);
daemonCmd.command('stop').action(stopDaemon);
daemonCmd.command('status').action(statusDaemon);

program.parseAsync().catch((err) => {
  logger.error(err);
  process.exit(1);
});

