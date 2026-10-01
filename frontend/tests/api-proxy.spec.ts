import { expect, test } from '@playwright/test';
import { createServer as createHttpServer } from 'node:http';
import { once } from 'node:events';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import viteConfig from '../vite.config';

test('the local proxy preserves browser headers, streams events and explains an offline backend', async () => {
  let finishStream = () => {};
  const upstream = createHttpServer((request, response) => {
    if (request.url === '/api/events') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      response.write('event: execution\ndata: {"sequence":1}\n\n');
      finishStream = () => { if (!response.writableEnded && !response.destroyed) response.end('event: execution\ndata: {"sequence":2}\n\n'); };
      return;
    }
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ host: request.headers.host, origin: request.headers.origin, cookie: request.headers.cookie, method: request.method, body }));
    });
  });
  let proxy: ViteDevServer | undefined;
  const previousTarget = process.env.DEV_API_PROXY_TARGET;
  try {
    upstream.listen(0, '127.0.0.1');
    await once(upstream, 'listening');
    const address = upstream.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP listener');
    const target = `http://127.0.0.1:${address.port}`;
    process.env.DEV_API_PROXY_TARGET = target;
    const config = viteConfig({ command: 'serve', mode: 'test' });
    if (previousTarget === undefined) delete process.env.DEV_API_PROXY_TARGET;
    else process.env.DEV_API_PROXY_TARGET = previousTarget;
    proxy = await createViteServer({ ...config, configFile: false, plugins: [], logLevel: 'silent',
      server: { ...config.server, host: '127.0.0.1', port: 0, strictPort: false, watch: null, hmr: false, preTransformRequests: false },
    });
    await proxy.listen();
    const proxyAddress = proxy.httpServer?.address();
    if (!proxyAddress || typeof proxyAddress === 'string') throw new Error('Expected a proxy listener');
    const origin = `http://127.0.0.1:${proxyAddress.port}`;
    const command = await fetch(`${origin}/api/lessons/review/live`, { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: 'session=fictional' }, body: '{"action":"classify"}',
    });
    expect(await command.json()).toEqual({ host: new URL(origin).host, origin, cookie: 'session=fictional', method: 'POST', body: '{"action":"classify"}' });
    const untrusted = await fetch(`${origin}/api/health`, { headers: { Origin: 'https://attacker.example' } });
    expect((await untrusted.json()).origin).toBe('https://attacker.example');

    const stream = await fetch(`${origin}/api/events`);
    expect(stream.headers.get('Content-Type')).toBe('text/event-stream');
    const reader = stream.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain('"sequence":1');
    // The first event must arrive before the upstream completes the stream.
    finishStream();
    let remaining = '';
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      remaining += new TextDecoder().decode(chunk.value);
    }
    expect(remaining).toContain('"sequence":2');
    upstream.closeAllConnections();
    await new Promise<void>(resolve => upstream.close(() => resolve()));

    const offline = await fetch(`${origin}/api/health`);
    expect(offline.status).toBe(503);
    expect(offline.headers.get('Content-Type')).toBe('application/json');
    expect(await offline.json()).toEqual({ detail: `Cannot reach the backend at ${target}. Start the backend and try again.` });
  } finally {
    if (previousTarget === undefined) delete process.env.DEV_API_PROXY_TARGET;
    else process.env.DEV_API_PROXY_TARGET = previousTarget;
    finishStream();
    await proxy?.close();
    upstream.closeAllConnections();
    await new Promise<void>(resolve => upstream.close(() => resolve()));
  }
});
