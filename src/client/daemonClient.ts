import http from 'http';
import { URL } from 'url';
import { socketFile } from '../core/runtime';
import { ProxmoxAuth } from '../adapters/proxmoxClient';

export interface DaemonClientOptions {
  baseUrl?: string;
  socketPath?: string;
  retries?: number;
}

export class DaemonClient {
  private baseUrl?: string;
  private socketPath: string;
  private retries: number;

  constructor(options: DaemonClientOptions = {}) {
    this.baseUrl = options.baseUrl;
    this.socketPath = options.socketPath ?? socketFile;
    this.retries = options.retries ?? 3;
  }

  private async request<T>(path: string, body?: any, method = 'POST'): Promise<T> {
    const attempt = async (n: number): Promise<T> => {
      const opts: http.RequestOptions = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (this.baseUrl) {
        const url = new URL(path, this.baseUrl);
        opts.protocol = url.protocol;
        opts.hostname = url.hostname;
        opts.port = url.port;
        opts.path = url.pathname + url.search;
      } else {
        opts.socketPath = this.socketPath;
        opts.path = path;
      }

      return await new Promise<T>((resolve, reject) => {
        const req = http.request(opts, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (d) => chunks.push(d));
          res.on('end', () => {
            const resBody = Buffer.concat(chunks).toString();
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve(resBody ? JSON.parse(resBody) : ({} as T));
              } catch (e) {
                reject(e);
              }
            } else if (res.statusCode && res.statusCode >= 500 && n < this.retries) {
              setTimeout(() => {
                attempt(n + 1).then(resolve).catch(reject);
              }, 500 * n);
            } else {
              reject(new Error(resBody || `HTTP ${res.statusCode}`));
            }
          });
        });
        req.on('error', (err) => {
          if (n < this.retries) {
            setTimeout(() => {
              attempt(n + 1).then(resolve).catch(reject);
            }, 500 * n);
          } else {
            reject(err);
          }
        });
        if (body) {
          req.write(JSON.stringify(body));
        }
        req.end();
      });
    };

    return attempt(1);
  }

  deploy(file: string, auth: ProxmoxAuth, sdnNetwork?: string, createSdn?: boolean): Promise<{ status: number }> {
    return this.request('/deploy', { compose: file, auth, sdnNetwork, createSdn });
  }

  start(vmid: string, auth: ProxmoxAuth): Promise<{ status: number }> {
    return this.request('/start', { vmid, auth });
  }

  stop(vmid: string, auth: ProxmoxAuth): Promise<{ status: number }> {
    return this.request('/stop', { vmid, auth });
  }
}

