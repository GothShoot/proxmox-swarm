import http from 'http';
import fs from 'fs';
import path from 'path';

const runtimeDir = path.resolve(__dirname, '../../runtime');
const pidFile = path.join(runtimeDir, 'daemon.pid');
const socketFile = path.join(runtimeDir, 'daemon.sock');

function cleanup() {
  try { fs.unlinkSync(pidFile); } catch {}
  try { fs.unlinkSync(socketFile); } catch {}
  process.exit(0);
}

if (!fs.existsSync(runtimeDir)) {
  fs.mkdirSync(runtimeDir, { recursive: true });
}

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
