import { spawnSync } from 'child_process';

export interface ProxmoxAuth {
  host?: string;
  user?: string;
  password?: string;
}

export interface ProxmoxRunOptions {
  ports?: string[];
  environment?: Record<string, string>;
}

export interface IProxmoxClient {
  run(cmd: string, args: string[], auth: ProxmoxAuth, options?: ProxmoxRunOptions): number;
  sdn(args: string[], auth: ProxmoxAuth, options?: ProxmoxRunOptions): number;
}

export class ProxmoxClient implements IProxmoxClient {
  run(cmd: string, args: string[], auth: ProxmoxAuth, options: ProxmoxRunOptions = {}): number {
    const env = {
      ...process.env,
      PROXMOX_HOST: auth.host,
      PROXMOX_USER: auth.user,
      PROXMOX_PASSWORD: auth.password,
    } as NodeJS.ProcessEnv;

    const finalArgs = [cmd, ...args];
    if (options.ports) {
      for (const port of options.ports) {
        finalArgs.push('-p', port);
      }
    }
    if (options.environment) {
      for (const [key, value] of Object.entries(options.environment)) {
        finalArgs.push('-e', `${key}=${value}`);
      }
    }

    const result = spawnSync('proxmox', finalArgs, {
      stdio: 'inherit',
      env,
    });

    if (result.error) {
      console.error(result.error.message);
      return result.status ?? 1;
    }

    return result.status ?? 0;
  }

  sdn(args: string[], auth: ProxmoxAuth, options: ProxmoxRunOptions = {}): number {
    return this.run('sdn', args, auth, options);
  }
}

