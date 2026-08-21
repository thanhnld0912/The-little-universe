import type { Request, Response } from 'express';
import { pingDatabase } from '../db/query.js';
import { sendData } from '../utils/respond.js';

/**
 * Diagnostic endpoint. Reports database reachability without revealing any
 * part of the connection string, host, credentials or driver error.
 *
 * Always answers HTTP 200 — read `data.status` to distinguish `ok` from
 * `degraded`. A degraded answer still proves the API process itself is alive,
 * which is exactly what you want when diagnosing a database outage.
 */
export async function getHealth(_req: Request, res: Response): Promise<void> {
  const connected = await pingDatabase();

  sendData(res, {
    status: connected ? 'ok' : 'degraded',
    database: connected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
}
