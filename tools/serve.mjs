#!/usr/bin/env node
// tools/serve.mjs — a tiny static file server. Two uses:
//
//   node tools/serve.mjs [--port 8123] [--root .]   // open pages in your own browser
//   import { startStaticServer } from './serve.mjs'  // used by tools/capture.mjs
//
// No frameworks, no build step: the project is plain static files, exactly the
// way it will be deployed later (step 10).

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.glb': 'model/gltf-binary',
};

/**
 * Serve `root` over http on 127.0.0.1.
 * @returns {Promise<{url:string, port:number, urlFor:(rel:string)=>string, close:()=>Promise<void>}>}
 */
export function startStaticServer({ root = process.cwd(), port = 0, host = '127.0.0.1' } = {}) {
  const rootDir = resolve(root);

  const server = createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end('Bad request');
      return;
    }

    let filePath = join(rootDir, pathname);
    // Stay inside the served root.
    if (filePath !== rootDir && !filePath.startsWith(rootDir + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, 'index.html');
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end(`404 ${pathname}`);
      return;
    }

    res.writeHead(200, {
      'content-type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'content-length': statSync(filePath).size,
      'cache-control': 'no-store',
    });
    createReadStream(filePath).pipe(res);
  });

  return new Promise((resolveDone, rejectDone) => {
    server.once('error', rejectDone);
    server.listen(port, host, () => {
      const { port: boundPort } = server.address();
      const base = `http://${host}:${boundPort}/`;
      resolveDone({
        url: base,
        port: boundPort,
        root: rootDir,
        urlFor: (rel) => base + String(rel).replace(/^\.?\/+/, '').split(/[\\/]+/).join('/'),
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (name, fallback) => {
    const i = process.argv.indexOf(name);
    return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
  };
  const root = resolve(arg('--root', dirname(fileURLToPath(import.meta.url)) + '/..'));
  const port = Number(arg('--port', 8123));
  startStaticServer({ root, port })
    .then((srv) => {
      console.log(`Serving ${root}`);
      console.log(`  test scene:  ${srv.url}tools/testscene.html`);
      console.log(`  style test:  ${srv.url}design/style-test.html`);
      console.log(`  voice test:  ${srv.url}tools/audio/voice-test.html`);
      console.log(`  contact sheet (after a capture):  ${srv.url}captures/testscene/_contact-sheet.html`);
      console.log('Ctrl+C to stop.');
    })
    .catch((err) => {
      console.error(`Could not listen on port ${port}: ${err.message}`);
      process.exit(1);
    });
}
