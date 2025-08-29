import { Command } from 'commander';
import { spawn } from 'child_process';
import fs from 'fs';
import { watch } from 'fs/promises';
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

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.promises.access(file);
    return true;
  } catch {
    return false;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCreation(file: string, timeout: number): Promise<boolean> {
  const dir = path.dirname(file);
  const target = path.basename(file);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  const watcher = watch(dir, { signal: ac.signal });
  let nextEvent = watcher.next();
  try {
    while (!ac.signal.aborted) {
      if (await fileExists(file)) {
        return true;
      }
      const result = await Promise.race([
        nextEvent,
        delay(100).then(() => undefined),
      ]);
      if (result && !result.done) {
        if (result.value.filename === target && (await fileExists(file))) {
          return true;
        }
        nextEvent = watcher.next();
      }
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      return false;
    }
    throw e;
  } finally {
    clearTimeout(timer);
    ac.abort();
  }
  return false;
}

async function waitForRemoval(file: string, timeout: number): Promise<boolean> {
  const dir = path.dirname(file);
  const target = path.basename(file);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  const watcher = watch(dir, { signal: ac.signal });
  let nextEvent = watcher.next();
  try {
    while (!ac.signal.aborted) {
      if (!(await fileExists(file))) {
        return true;
      }
      const result = await Promise.race([
        nextEvent,
        delay(100).then(() => undefined),
      ]);
      if (result && !result.done) {
        if (result.value.filename === target && !(await fileExists(file))) {
          return true;
        }
        nextEvent = watcher.next();
      }
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      return false;
    }
    throw e;
  } finally {
    clearTimeout(timer);
    ac.abort();
  }
  return false;
}

export async function startDaemon() {
  ensureRuntimeDir();
  if (await fileExists(pidFile)) {
    const existing = Number(await fs.promises.readFile(pidFile, 'utf8'));
    if (isRunning(existing)) {
      logger.info(`Daemon already running (PID ${existing})`);
      return;
    }
    await fs.promises.unlink(pidFile);
  }
  const daemonPath = path.resolve(__dirname, '..', 'core', 'daemon.js');
  const child = spawn(process.execPath, [daemonPath], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  const created = await waitForCreation(pidFile, 5000);
  if (created) {
    const pid = Number(await fs.promises.readFile(pidFile, 'utf8'));
    logger.info(`Daemon started (PID ${pid})`);
  } else {
    logger.error('Failed to start daemon');
  }
}

export async function stopDaemon() {
  if (!(await fileExists(pidFile))) {
    logger.info('Daemon not running');
    return;
  }
  const pid = Number(await fs.promises.readFile(pidFile, 'utf8'));
  if (!isRunning(pid)) {
    logger.info('Daemon not running');
    await fs.promises.unlink(pidFile);
    return;
  }
  process.kill(pid);
  const removed = await waitForRemoval(pidFile, 5000);
  if (!removed) {
    logger.error('Failed to stop daemon');
    return;
  }
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

if (require.main === module) {
  program.parseAsync().catch((err) => {
    logger.error(err);
    process.exit(1);
  });
}

