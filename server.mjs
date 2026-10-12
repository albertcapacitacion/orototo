import { createServer } from 'node:http';
import { watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5173);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};
const publicFiles = new Set([
  'index.html',
  'style.css',
  'app.js',
  'assets/bangle.svg',
  'assets/chain.svg',
  'assets/coin.svg',
  'assets/hoops.svg',
  'assets/logo.svg',
  'assets/pendant.svg',
  'assets/solitaire.svg',
]);
const clients = new Set();

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
    return;
  }

  const pathname = new URL(request.url, 'http://localhost').pathname;

  if (pathname === '/__reload') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    response.write(': connected\n\n');
    clients.add(response);
    request.on('close', () => clients.delete(response));
    return;
  }

  let relativePath;
  try {
    relativePath = decodeURIComponent(pathname).replace(/^\/+/, '');
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }
  if (!relativePath) relativePath = 'index.html';

  if (!publicFiles.has(relativePath)) {
    response.writeHead(404).end('Not found');
    return;
  }

  const filePath = path.join(root, relativePath);

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('Not a file');
    let content = await readFile(filePath);
    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';

    if (path.extname(filePath).toLowerCase() === '.html') {
      const liveReload = '<script>new EventSource("/__reload").onmessage=()=>location.reload();</script>';
      content = Buffer.from(content.toString('utf8').replace(/<\/body>/i, `${liveReload}</body>`));
    }

    response.writeHead(200, { 'Content-Type': contentType, 'Content-Length': content.length });
    if (request.method === 'HEAD') response.end();
    else response.end(content);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

let reloadTimer;
const watcher = watch(root, { recursive: true }, (_event, filename) => {
  if (filename && String(filename).startsWith('.')) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    for (const client of clients) client.write('data: reload\n\n');
  }, 120);
});

server.on('error', (error) => {
  watcher.close();
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the other server or set PORT to use a different port.`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Website server: http://localhost:${port}`);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        console.log(`Home network:  http://${address.address}:${port}`);
      }
    }
  }
  console.log('Hot reload is enabled. Press Ctrl+C to stop.');
});

function stop() {
  watcher.close();
  for (const client of clients) client.end();
  server.close(() => process.exit(0));
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
