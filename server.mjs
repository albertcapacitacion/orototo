import { createServer } from 'node:http';
import { watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './api.mjs';
import { openStore } from './database/local.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5173);
const store = openStore(process.env.OROTOTO_DB || path.join(root, 'database/orototo.sqlite'));
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
  'assets/products/a1-chain.png',
  'assets/products/a2-ring.png',
  'assets/products/a3-coin.png',
  'assets/products/a4-pendant.png',
]);
const clients = new Set();
const allowedHosts = new Set([
  `localhost:${port}`, `127.0.0.1:${port}`,
  ...(port === 80 ? ['localhost', '127.0.0.1'] : []),
]);

const server = createServer(async (request, response) => {
  if (!allowedHosts.has(request.headers.host)) {
    response.writeHead(403).end('Host not allowed');
    return;
  }
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname.startsWith('/api/')) {
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 16384) {
          response.writeHead(413, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Request too large.' }));
          return;
        }
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      const apiResponse = await handleApi(new Request(`http://${request.headers.host}${request.url}`, {
        method: request.method,
        headers: request.headers,
        ...(!['GET', 'HEAD'].includes(request.method) ? { body } : {}),
      }), store);
      response.writeHead(apiResponse.status, Object.fromEntries(apiResponse.headers));
      response.end(Buffer.from(await apiResponse.arrayBuffer()));
    } catch (error) {
      console.error('API request failed:', error.message);
      if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Request could not be completed.' }));
    }
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
    return;
  }

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
    if (!filename || !['index.html', 'style.css', 'app.js'].includes(String(filename))) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    for (const client of clients) client.write('data: reload\n\n');
  }, 120);
});

server.on('error', (error) => {
  watcher.close();
  store.close();
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the other server or set PORT to use a different port.`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.requestTimeout = 15000;
server.listen(port, '127.0.0.1', () => {
  console.log(`Website server: http://localhost:${port}`);
  console.log('Hot reload is enabled. Press Ctrl+C to stop.');
});

function stop() {
  watcher.close();
  for (const client of clients) client.end();
  server.close(() => { store.close(); process.exit(0); });
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
