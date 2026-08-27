/**
 * Boots the real Express app on an ephemeral port and talks to it over HTTP.
 *
 * The whole stack is exercised — helmet, cors, the body parser, validation,
 * the routes and the central error handler — because most of what these tests
 * assert (status codes, the response envelope, what is absent from a body)
 * is produced by that middleware chain rather than by any single function.
 *
 * No HTTP test library is used: `app.listen(0)` plus the built-in `fetch` is
 * enough, and avoids a dependency that exists only for tests.
 */
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

export interface ApiResponse<T = unknown> {
  status: number;
  body: {
    success?: boolean;
    data?: T;
    error?: { code?: string; message?: string; details?: unknown };
  };
  raw: string;
  /** Response headers, so tests can assert on things like `set-cookie`. */
  headers: Headers;
}

export interface TestServer {
  request: (
    method: string,
    path: string,
    options?: { body?: unknown; token?: string; headers?: Record<string, string> },
  ) => Promise<ApiResponse>;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  // Set before importing anything that reads configuration: `env.ts` reads
  // `process.env` once, at import time, and dotenv does not override a value
  // that is already set. This keeps request logging out of the test output.
  process.env['NODE_ENV'] = 'test';

  const { createApp } = await import('../../src/app.js');
  const app = createApp();

  const server: Server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });

  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  return {
    async request(method, path, options = {}) {
      const headers: Record<string, string> = { ...options.headers };
      if (options.body !== undefined) headers['Content-Type'] = 'application/json';
      if (options.token !== undefined) headers['Authorization'] = `Bearer ${options.token}`;

      const response = await fetch(`${base}${path}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });

      const raw = await response.text();
      let body: ApiResponse['body'] = {};
      try {
        body = JSON.parse(raw) as ApiResponse['body'];
      } catch {
        // Left as {} — `raw` is asserted against directly when this happens.
      }
      return { status: response.status, body, raw, headers: response.headers };
    },

    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

/** A collision-proof address for a test account. */
export function testEmail(label: string): string {
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `phase3-${label}-${unique}@tests.invalid`;
}
