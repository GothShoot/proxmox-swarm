import http from 'http';
import fs from 'fs';
import { ensureRuntimeDir, pidFile, socketFile } from './runtime';
import { ProxmoxClient } from '../adapters/proxmoxClient';
import { ComposeService } from '../services/composeService';
import { NetworkService } from '../services/networkService';
import { StorageService } from '../services/storageService';

const proxmox = new ProxmoxClient();
const composeService = new ComposeService();
const networkService = new NetworkService(proxmox);
const storageService = new StorageService(proxmox);

function cleanup() {
  try { fs.unlinkSync(pidFile); } catch {}
  try { fs.unlinkSync(socketFile); } catch {}
  process.exit(0);
}

ensureRuntimeDir();

if (fs.existsSync(socketFile)) {
  try { fs.unlinkSync(socketFile); } catch {}
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/compose/parse') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const { file } = JSON.parse(body);
        const result = composeService.parse(file);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (e as Error).message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/network/attach') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const { auth, vmid, network, tags, vlan } = JSON.parse(body);
        const status = networkService.attachToSDN(auth ?? {}, vmid, network, tags, vlan);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (e as Error).message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/storage/subvolume') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const { auth, subvolume, options } = JSON.parse(body);
        const status = storageService.createSubvolume(auth ?? {}, subvolume, options);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (e as Error).message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/storage/mount') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const { auth, vmid, target, subvolume, mode, options } = JSON.parse(body);
        const status = storageService.mount(auth ?? {}, vmid, target, subvolume, mode, options);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (e as Error).message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});
fs.writeFileSync(pidFile, String(process.pid));

server.listen(socketFile, () => {
  console.log(`Daemon listening on ${socketFile}`);
});

server.on('error', (err) => {
  console.error(err);
  cleanup();
});

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

