/**
 * Talks to the backend.
 *
 * Everything the API returns is wrapped in `{ success, data }` or
 * `{ success, error }`. That envelope is unwrapped here, once, so the views
 * never handle it and a shape change has exactly one place to be fixed.
 *
 * Requests are same-origin: the site and the API are one Vercel project, so
 * `/api/...` resolves without a base URL and the visitor cookie the server
 * issues travels automatically. `fetch` defaults to `credentials: 'same-origin'`
 * — that default is what makes each visitor's readings their own, so do not set
 * `credentials: 'omit'` here.
 */

/** Shapes returned by the server. Kept separate from the view models. */
export interface DailyPrediction {
  date: string;
  theme: string;
  energy: string;
  energyScore: number;
  luckyColor: string;
  luckyColorHex: string | null;
  luckyNumber: number;
  mood: string;
  prediction: string;
  cosmicQuote: string | null;
  cosmicSign: string | null;
  element: string | null;
  soundFrequency: string | null;
}

export interface WeeklyDay {
  id: string;
  date: string;
  day: string;
  shortName: string;
  type: string;
  tagline: string;
  prediction: string;
  score: number;
  isPeak: boolean;
  element: string | null;
  gemstone: string | null;
  highlightTitle?: string;
  highlightQuote?: string;
}

export interface WeeklyPrediction {
  weekStart: string;
  weekEnd: string;
  summary: string;
  brightestDay: string;
  days: WeeklyDay[];
}

/** Carries the server's error code so a caller can distinguish causes. */
export class ApiError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

interface Envelope<T> {
  success?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    // A network failure is not the same as the server refusing, and the
    // distinction is what the view needs in order to say something useful.
    throw new ApiError('The stars are out of reach right now.', 'NETWORK_ERROR');
  }

  let body: Envelope<T> = {};
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new ApiError('The sky returned something unreadable.', 'BAD_RESPONSE');
  }

  if (!response.ok || body.success !== true || body.data === undefined) {
    throw new ApiError(
      body.error?.message ?? 'Something went wrong reading the sky.',
      body.error?.code ?? 'UNKNOWN_ERROR',
    );
  }

  return body.data;
}

export function fetchDailyPrediction(): Promise<DailyPrediction> {
  return request<DailyPrediction>('/api/predictions/daily');
}

export function fetchWeeklyPrediction(): Promise<WeeklyPrediction> {
  return request<WeeklyPrediction>('/api/predictions/weekly');
}

export type MessageMood =
  | 'quiet'
  | 'romantic'
  | 'hopeful'
  | 'restless'
  | 'peaceful'
  | 'mystical';

export interface UniverseMessage {
  id: string;
  date: string;
  mood: MessageMood;
  /** Absent when the person wrote nothing — never an empty string. */
  userPrompt?: string;
  title: string;
  subtitle: string;
  celestialSign: string;
  whisper: string;
  affirmation: string;
  actionGuidance: string;
  luckyNumber: string;
  cosmicEnergy: string;
}

/**
 * Asks for a message for this mood, and for the person's own words if they
 * wrote any.
 *
 * Idempotent on the server: the same mood and the same words on the same day
 * return the message already written rather than a new one, so a double-tap
 * costs nothing and the message does not change under the reader.
 */
export function createUniverseMessage(
  mood: MessageMood,
  prompt?: string,
): Promise<UniverseMessage> {
  const trimmed = prompt?.trim();
  return request<UniverseMessage>('/api/messages', {
    method: 'POST',
    // Omitted rather than sent as '': the server rejects an empty note, and
    // "wrote nothing" is the absence of the field.
    body: trimmed ? { mood, prompt: trimmed } : { mood },
  });
}

// --- tarot ------------------------------------------------------------------

export type TarotOrientation = 'upright' | 'reversed';

export interface TarotCardFace {
  id: string;
  slug: string;
  name: string;
  arcana: string;
  suit: string | null;
  number: number | null;
  numeral: string | null;
  archetype: string;
  keywords: string[];
  element: string | null;
  imageUrl: string | null;
}

export interface TarotDrawnCard {
  position: number;
  positionName: string;
  orientation: TarotOrientation;
  /**
   * The meaning for the orientation actually drawn. The server returns only
   * this one, never both, so a reading cannot be re-read as the other.
   */
  meaning: string;
  card: TarotCardFace;
}

export interface TarotDraw {
  drawId: string;
  spread: string;
  question: string | null;
  createdAt: string;
  expiresAt: string;
  interpreted: boolean;
  cards: TarotDrawnCard[];
}

export interface TarotReading {
  title: string;
  summary: string;
  interpretation: string;
  guidance: string;
  reflectionQuestion: string;
}

export interface InterpretedTarotDraw extends TarotDraw {
  reading: TarotReading;
}

/**
 * Draws a card.
 *
 * THE SERVER CHOOSES THE CARD, and there is no parameter through which a
 * caller could ask for a particular one. The choice is made with a
 * cryptographic random source and written down before the response is built,
 * so the card and its orientation are settled facts by the time they arrive.
 */
export function drawTarotCard(question?: string): Promise<TarotDraw> {
  const trimmed = question?.trim();
  return request<TarotDraw>('/api/tarot/draw', {
    method: 'POST',
    body: trimmed ? { question: trimmed } : {},
  });
}

/**
 * Asks for the reading of a card already drawn.
 *
 * Only the draw id is sent. The card, its orientation and its meaning are read
 * from what the server stored at draw time, so none of them can be substituted
 * here.
 *
 * Idempotent: a draw that already has a reading returns it without generating
 * anything, so a retry after a dropped connection costs nothing and cannot
 * rewrite what someone already read.
 */
export function interpretTarotDraw(drawId: string): Promise<InterpretedTarotDraw> {
  return request<InterpretedTarotDraw>('/api/tarot/interpret', {
    method: 'POST',
    body: { drawId },
  });
}

// --- sharing ----------------------------------------------------------------

/**
 * What to share.
 *
 * Notice that no variant carries any CONTENT. A share names which of your own
 * readings to snapshot; the server builds the text from what it already stored.
 * `secret` is the one exception, and its `note` is your own words, presented to
 * the reader as a message from a person rather than as a reading.
 */
export type ShareTarget =
  | { kind: 'daily' }
  | { kind: 'weekly' }
  | { kind: 'tarot'; drawId: string }
  | { kind: 'message'; messageId: string }
  | { kind: 'secret'; note: string };

export type ShareKind = ShareTarget['kind'];

export interface CreatedShare {
  slug: string;
  kind: ShareKind;
  createdAt: string;
}

/** The snapshot a recipient sees for a shared tarot reading. */
export interface SharedTarotContent {
  question: string | null;
  positionName: string;
  orientation: TarotOrientation;
  meaning: string;
  card: {
    name: string;
    arcana: string;
    numeral: string | null;
    archetype: string;
    keywords: string[];
    element: string | null;
  };
  reading: TarotReading;
}

/** The snapshot a recipient sees for a shared universe message. */
export interface SharedMessageContent {
  date: string;
  mood: MessageMood;
  title: string;
  subtitle: string;
  celestialSign: string;
  whisper: string;
  affirmation: string;
  actionGuidance: string;
  luckyNumber: string;
  cosmicEnergy: string;
}

/**
 * What the recipient receives.
 *
 * `content` and `note` are mutually exclusive and either may be absent, which
 * is why the view narrows on `kind` before reading either. Neither is ever
 * returned empty — an absent value is an absent field.
 */
export interface SharedContent {
  kind: ShareKind;
  createdAt: string;
  content?: unknown;
  note?: string;
}

/** Creates a link. Not idempotent: asking twice gives two links, on purpose. */
export function createShare(target: ShareTarget): Promise<CreatedShare> {
  return request<CreatedShare>('/api/shares', { method: 'POST', body: target });
}

/** Reads a share. Public — the recipient needs no account and no cookie. */
export function fetchShare(slug: string): Promise<SharedContent> {
  return request<SharedContent>(`/api/shares/${encodeURIComponent(slug)}`);
}

/** The path a share lives at. One definition, so the link and the router agree. */
export function shareUrlFor(slug: string): string {
  return `${window.location.origin}/s/${slug}`;
}
