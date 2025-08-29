import os from 'os';
import path from 'path';
import fs from 'fs';

function baseRuntimeDir(): string {
  if (process.env.XDG_RUNTIME_DIR) {
    return process.env.XDG_RUNTIME_DIR;
  }
  try {
    return path.join(os.homedir(), '.config');
  } catch {
    return os.tmpdir();
  }
}

export const runtimeDir = path.join(baseRuntimeDir(), 'proxmox-swarm');

export function ensureRuntimeDir() {
  if (!fs.existsSync(runtimeDir)) {
    fs.mkdirSync(runtimeDir, { recursive: true });
  }
}

export const pidFile = path.join(runtimeDir, 'daemon.pid');
export const logFile = path.join(runtimeDir, 'daemon.log');
export const socketFile = path.join(runtimeDir, 'daemon.sock');

