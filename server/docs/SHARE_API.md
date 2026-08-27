# Share API

A link you can send to someone who is not you.

Two things live behind one endpoint because they are mechanically the same
feature: **sharing a reading you received**, and **writing a secret message of
your own**. Both are durable content behind an unguessable URL, readable by
anyone holding it.

---

## The security model, in one paragraph

**The client never writes the content of a share.** `POST /api/shares` names
*which* of the caller's own readings to snapshot; the server builds the text
from what it already stored. There is no request shape carrying a `title`, a
`whisper` or a `payload` — sending one is **rejected with 400**, not ignored. If
a client could supply the text, anyone could publish arbitrary content on this
domain under the app's name, which is a phishing and impersonation vector rather
than a hypothetical one. `note` on a secret message is the single exception, is
stored in its own column with its own length limit, and is presented to the
reader as words from a person rather than as a reading.

---

## `POST /api/shares`

Authentication is optional; the caller is identified by the `tlu_visitor`
cookie, or by a bearer token when one is offered.

The body is a **discriminated union on `kind`**, so each kind carries exactly
what it needs and nothing it does not. `{ "kind": "daily", "drawId": "…" }` is
rejected, and `{ "kind": "tarot" }` cannot arrive without its draw.

```jsonc
{ "kind": "daily" }                          // your reading for today
{ "kind": "weekly" }                         // your week ahead
{ "kind": "tarot",   "drawId": "uuid" }      // a card you drew
{ "kind": "message", "messageId": "uuid" }   // a message written for you
{ "kind": "secret",  "note": "…" }           // your own words, 1-500 chars
```

The date is the application's, never the client's — the same rule as everywhere
else, so a caller cannot name the day whose reading it shares.

### Response `201`

```jsonc
{ "success": true, "data": {
  "slug": "kJ8-2mQz1xVbNp7A",
  "kind": "daily",
  "createdAt": "2026-08-27T05:41:02.118Z"
} }
```

**201, and not idempotent.** Unlike the readings, asking twice creates two
links. Someone sending the same reading to two people expects two links.

The `slug` is 16 base64url characters — 96 bits from a cryptographic source. It
is the only thing protecting the content, which is why it is not sequential, not
derived from anything, and not the row's primary key.

### What you can share

Only your own. The predictions are looked up by the caller's subject and the
message lookup is scoped to it, so naming someone else's `messageId` returns
**404** — not found rather than found and refused, because the id is simply not
visible to you.

### Errors

| Status | Code               | When                                                            |
| ------ | ------------------ | --------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR` | Unknown kind, missing or malformed id, blank or oversized note, or any unexpected field |
| 404    | `NOT_FOUND`        | The draw or message named is not the caller's, or does not exist |
| 429    | `RATE_LIMITED`     | More than 30 links from one sender in a day                      |

The cap exists because this endpoint mints public URLs on this domain from text
a person writes, which is the shape of thing that gets used to host spam. It is
generous enough that nobody sharing readings will meet it.

---

## `GET /api/shares/:slug`

**No authentication, and no subject middleware.** A share is for a stranger
holding the link. Resolving a subject here would set a visitor cookie on someone
who has done nothing but open a link — quietly enrolling every recipient as a
tracked visitor of a site they may never use.

### Response `200`

```jsonc
{ "success": true, "data": {
  "kind": "daily",
  "createdAt": "2026-08-27T05:41:02.118Z",
  "content": { … }              // the snapshot; absent for a secret message
} }
```

```jsonc
{ "success": true, "data": {
  "kind": "secret",
  "createdAt": "2026-08-27T05:41:02.118Z",
  "note": "I am proud of you."  // absent for every other kind
} }
```

`content` and `note` are mutually exclusive, and neither is ever returned empty.
An absent value is an absent field, never `{}` or `""` — both of which are
truthy on a client and render as "present".

**The sender is never revealed.** No `subjectId`, no user, no row id. A share is
what someone chose to send, not a statement about who they are.

### The snapshot is a copy, not a reference

What was shared is what the recipient sees, permanently. The underlying reading
is keyed to one subject and one day, so a reference would show today's reading
under a link sent last week — and would force this endpoint to reason about
whose row it is allowed to return. A snapshot has no such question to get wrong.

Ids are stripped when the snapshot is built. A shared tarot reading carries no
`drawId`, because a recipient holding one could read the draw directly through
the tarot API, and no `expiresAt`, because a share does not expire with the draw
it was taken from.

### Errors

| Status | Code        | When                            |
| ------ | ----------- | ------------------------------- |
| 404    | `NOT_FOUND` | No such slug, or a malformed one |

Both cases give the **same** code and the same message. A reader learns nothing
about which slugs are real.

---

## Lifetime

Shares do not expire. The link is the only secret; anyone holding it can read it
for as long as it exists.

There is deliberately no one-time reveal. Link previews in Slack, iMessage and
WhatsApp fetch a URL automatically, so a message destroyed on first read would
routinely be destroyed by a preview bot before the person it was written for ever
opened it — unrecoverably.
