import http from 'http';
import fs from 'fs';
import { ensureRuntimeDir, pidFile, socketFile } from './runtime';
import { ProxmoxClient } from '../adapters/proxmoxClient';
import { ComposeService } from '../services/composeService';
import { NetworkService } from '../services/networkService';
import { StorageService } from '../services/storageService';
import { createLogger } from './logger';
import { Counter, Histogram, collectDefaultMetrics, register } from 'prom-client';

const proxmox = new ProxmoxClient();
const composeService = new ComposeService();
const networkService = new NetworkService(proxmox);
const storageService = new StorageService(proxmox);
const logger = createLogger(true);

collectDefaultMetrics();
const requestCounter = new Counter({
  name: 'proxmox_swarm_requests_total',
  help: 'Total number of daemon requests',
  labelNames: ['route'],
});
const requestDuration = new Histogram({
  name: 'proxmox_swarm_request_duration_seconds',
  help: 'Duration of daemon requests in seconds',
  labelNames: ['route'],
});

const KNOWN_ROUTES = new Set([
  'GET /status',
  'GET /metrics',
  'POST /compose/parse',
  'POST /deploy',
  'POST /start',
  'POST /stop',
  'POST /network/attach',
  'POST /storage/subvolume',
  'POST /storage/mount',
]);

function cleanup() {
  try { fs.unlinkSync(pidFile); } catch {}
  try { fs.unlinkSync(socketFile); } catch {}
  process.exit(0);
}

ensureRuntimeDir();

if (fs.existsSync(socketFile)) {
  try { fs.unlinkSync(socketFile); } catch {}
}

const server = http.createServer(async (req, res) => {
  const path = req.url?.split('?')[0] || '';
  const key = `${req.method} ${path}`;
  const route = KNOWN_ROUTES.has(key) ? key : 'unknown';
  requestCounter.inc({ route });
  const endTimer = requestDuration.startTimer({ route });
  res.on('finish', endTimer);

  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.method === 'GET' && req.url === '/metrics') {
    try {
      const metrics = await register.metrics();
      res.writeHead(200, { 'Content-Type': register.contentType });
      res.end(metrics);
    } catch (e) {
      logger.error(e);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    }
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
        logger.error(e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/deploy') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const { compose, auth, sdnNetwork, createSdn } = JSON.parse(body);
        const { services, volumes } = composeService.parse(compose);

        if (sdnNetwork && createSdn) {
          const netStatus = proxmox.run('sdn', ['create', sdnNetwork], auth ?? {});
          if (netStatus !== 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: netStatus }));
            return;
          }
        }

        for (const volDef of Object.values(volumes)) {
          if (volDef.external) {
            continue;
          }
          const volStatus = storageService.createSubvolume(auth ?? {}, volDef.subvolume, volDef.options);
          if (volStatus !== 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: volStatus }));
            return;
          }
        }

        for (const [name, cfg] of Object.entries(services)) {
          const status = proxmox.run('deploy', [name, cfg.image], auth ?? {});
          if (status !== 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status }));
            return;
          }
          if (sdnNetwork) {
            const sdnStatus = networkService.attachToSDN(
              auth ?? {},
              name,
              sdnNetwork,
              cfg.tags,
              cfg.vlan
            );
            if (sdnStatus !== 0) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: sdnStatus }));
              return;
            }
          }
          for (const mount of cfg.volumes) {
            const def = volumes[mount.volume];
            if (!def) {
              logger.warn(`Volume ${mount.volume} not defined in compose file`);
              continue;
            }
            const mStatus = storageService.mount(
              auth ?? {},
              name,
              mount.target,
              def.subvolume,
              mount.mode,
              def.options
            );
            if (mStatus !== 0) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: mStatus }));
              return;
            }
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 0 }));
      } catch (e) {
        logger.error(e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/start') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const { vmid, auth } = JSON.parse(body);
        const status = proxmox.run('start', [vmid], auth ?? {});
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status }));
      } catch (e) {
        logger.error(e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/stop') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const { vmid, auth } = JSON.parse(body);
        const status = proxmox.run('stop', [vmid], auth ?? {});
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status }));
      } catch (e) {
        logger.error(e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
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
        logger.error(e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
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
        logger.error(e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
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
        logger.error(e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});
fs.writeFileSync(pidFile, String(process.pid));

server.listen(socketFile, () => {
  logger.info(`Daemon listening on ${socketFile}`);
});

server.on('error', (err) => {
  logger.error(err);
  cleanup();
});

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

