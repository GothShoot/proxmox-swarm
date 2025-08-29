import http from 'http';
import fs from 'fs';
import { ensureRuntimeDir, pidFile, socketFile } from '../runtime';

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
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
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
