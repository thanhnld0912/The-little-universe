import type { Request, Response } from 'express';
import {
  drawSingleCard,
  getHistoryEntry,
  interpretDraw,
  listCards,
  listHistory,
} from '../services/tarot.service.js';
import type { DrawRequest, InterpretRequest } from '../schemas/tarot.schema.js';
import { requireUserId } from '../middleware/auth.js';
import { sendData } from '../utils/respond.js';

/** GET /api/tarot/cards */
export async function getCards(_req: Request, res: Response): Promise<void> {
  sendData(res, { cards: await listCards() });
}

/**
 * POST /api/tarot/draw
 *
 * The server picks the card and orientation and persists them before this
 * responds. Signing in is optional; a signed-in draw is bound to that account.
 */
export async function postDraw(req: Request, res: Response): Promise<void> {
  const body = req.body as DrawRequest;
  const draw = await drawSingleCard({
    userId: req.auth?.userId ?? null,
    question: body.question ?? null,
  });
  sendData(res, draw, 201);
}

/** POST /api/tarot/interpret */
export async function postInterpret(req: Request, res: Response): Promise<void> {
  const body = req.body as InterpretRequest;
  const result = await interpretDraw({
    drawId: body.drawId,
    requesterId: req.auth?.userId ?? null,
  });
  sendData(res, result);
}

/** GET /api/tarot/history — the signed-in user's own draws. */
export async function getHistory(req: Request, res: Response): Promise<void> {
  sendData(res, { readings: await listHistory(requireUserId(req)) });
}

/** GET /api/tarot/history/:id */
export async function getHistoryById(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] ?? '';
  sendData(res, await getHistoryEntry(id, req.auth?.userId ?? null));
}
