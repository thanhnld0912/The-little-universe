# Tarot API contract (Phase 5B)

For Phase 8 frontend integration. Every response uses the standard envelope:

```jsonc
{ "success": true,  "data": { … } }
{ "success": false, "error": { "code": "…", "message": "…", "details": { … } } }
```

`details` is **omitted** when absent — never `{}` or `""`.

---

## The security model, in one paragraph

**The client never chooses a card.** `POST /draw` makes the server pick a card
and an orientation, write both to the database, and return an opaque
`drawId`. `POST /interpret` accepts *only* that id and re-reads the decision.
Sending `cardId`, `cardName`, `slug` or `orientation` to either endpoint is
**rejected with 400**, not silently ignored. There is no request shape in which
a client can name the card it wants.

---

## `GET /api/tarot/cards`

The full 78-card deck. No auth. **Meanings are not included** — they reach a
client only through a draw, and only for the orientation drawn.

```jsonc
{ "cards": [ {
  "id": "uuid", "slug": "the-star", "name": "The Star",
  "arcana": "major",            // "major" | "minor"
  "suit": null,                 // null for majors; "cups"|"wands"|"swords"|"pentacles"
  "number": 17,                 // majors 0-21; minors 1-14 (11=Page … 14=King)
  "numeral": "XVII",
  "archetype": "Hope, Renewal & Gentle Light",
  "keywords": ["Hope", "Healing", "Renewal", "Faith"],
  "element": "Aquarius",
  "imageUrl": null              // always null in the MVP; the UI draws its own SVG
} ] }
```

## `POST /api/tarot/draw`

Auth **optional**. With a bearer token the draw is bound to that account and
becomes private to it; without one it is anonymous and reachable by anyone
holding the `drawId`.

**Request** — `{ "question": "optional, 1-300 chars" }` or `{}`.
Any other key → **400**.

**Response `201`**

```jsonc
{
  "drawId": "uuid",             // the ONLY handle the client needs
  "spread": "single",
  "question": "…" | null,
  "createdAt": "ISO", "expiresAt": "ISO",
  "interpreted": false,
  "cards": [ {
    "position": 0, "positionName": "CARD I",
    "orientation": "upright",   // "upright" | "reversed" — fixed for this draw's lifetime
    "meaning": "…",             // the meaning for THIS orientation only
    "card": { /* the card object above */ }
  } ]
}
```

## `POST /api/tarot/interpret`

Auth optional; must match the draw's owner if it has one.

**Request** — `{ "drawId": "uuid" }`. Any other key → **400**.

**Response `200`** — the draw object above, plus `interpreted: true` and:

```jsonc
"reading": {
  "title": "…", "summary": "…", "interpretation": "…",
  "guidance": "…", "reflectionQuestion": "…"
}
```

**Idempotent.** Calling it again returns the identical reading and performs
**zero** additional AI generations. Safe to retry.

| Status | When |
|---|---|
| `400` | malformed/missing `drawId`, or any extra field |
| `404` | unknown draw, **or** a draw belonging to another account |
| `409` | the draw expired (24 h) before being interpreted |
| `502` | the AI failed or returned invalid output twice |

## `GET /api/tarot/history`

**Requires auth.** The signed-in user's own draws, newest first, max 20.

```jsonc
{ "readings": [ {
  "drawId": "uuid", "question": "…" | null, "createdAt": "ISO",
  "interpreted": true, "orientation": "reversed",
  "card": { "name": "The Moon", "slug": "the-moon", "arcana": "major", "suit": null }
} ] }
```

## `GET /api/tarot/history/:id`

Auth optional. Returns the draw object, plus `reading` when it has one.
Anonymous draws are readable by anyone with the id; owned draws only by their
owner (others get **404**, never 403 — a 403 would confirm the draw exists).
Expired draws remain readable here; expiry only blocks *new* interpretation.

---

## Notes for Phase 8

- Today's `TarotView` reveals `TAROT_DECK[index]` on click, i.e. **the client
  picks**. That must become: click → `POST /draw` → flip to the returned card →
  `POST /interpret`.
- The three face-down cards are positional artwork (`TarotCardBackI/II/III`),
  not three different cards. The MVP draws **one** card whichever back is
  clicked. A real three-card spread is a separate phase.
- `TarotCard.cardIndex` maps to `positionName` (`"CARD I"`).
- `TarotCard.visualType` is declared in `types.ts` but never rendered; the API
  does not supply it.
- The UI's `meaning` / `guidance` / `affirmation` blocks map to
  `meaning` (card) and the reading's `interpretation` / `guidance`. There is no
  `affirmation` field — `reflectionQuestion` is the nearest equivalent and is
  a question, so the label needs changing rather than the data.
- `interpret` can take a few seconds on a real provider. The existing
  "Listening to the stars…" spinner pattern applies; a **loading and an error
  state are required** here, and neither exists in the UI today.
