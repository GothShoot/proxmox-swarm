import { spawnSync } from 'child_process';

export interface ProxmoxAuth {
  host?: string;
  user?: string;
  password?: string;
}

export function runProxmox(cmd: string, args: string[], auth: ProxmoxAuth): number {
  const env = {
    ...process.env,
    PROXMOX_HOST: auth.host,
    PROXMOX_USER: auth.user,
    PROXMOX_PASSWORD: auth.password,
  } as NodeJS.ProcessEnv;

  const result = spawnSync('proxmox', [cmd, ...args], {
    stdio: 'inherit',
    env,
  });

  if (result.error) {
    console.error(result.error.message);
    return result.status ?? 1;
  }

  return result.status ?? 0;
}
