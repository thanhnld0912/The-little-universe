# Message API

A short, personal message written for the mood someone chose and, if they wrote
any, for their own words.

## `POST /api/messages`

Authentication is optional. Without it the caller is identified by the
`tlu_visitor` cookie the server issues; with a bearer token the message is bound
to that account instead, so it follows the person between devices.

### Request

```json
{
  "mood": "quiet",
  "prompt": "I am trying to be gentler with myself this week."
}
```

| Field    | Required | Notes                                                                   |
| -------- | -------- | ----------------------------------------------------------------------- |
| `mood`   | yes      | One of `quiet`, `romantic`, `hopeful`, `restless`, `peaceful`, `mystical` |
| `prompt` | no       | Their own words. Trimmed, 1–200 characters. **Omit it** rather than sending `""` |

The body is validated with `strictObject`: any other field — a `whisper`, a
`title`, a `subjectId` — is **rejected with 400**, not ignored. The message
content is written by the server and can never be supplied by the caller, and
the caller cannot choose whose message it is.

### Response `200`

```json
{
  "success": true,
  "data": {
    "id": "…",
    "date": "2026-08-27",
    "mood": "quiet",
    "userPrompt": "I am trying to be gentler with myself this week.",
    "title": "A Small Light, Left On",
    "subtitle": "For a heart that has been carrying more than it says",
    "celestialSign": "Moon in Aquarius • Full Moon",
    "whisper": "…",
    "affirmation": "…",
    "actionGuidance": "…",
    "luckyNumber": "07",
    "cosmicEnergy": "Serene Moonlight"
  }
}
```

`userPrompt` is **absent** when they wrote nothing. It is never returned as an
empty string — an absent value is an absent field.

`celestialSign` is calculated from the sky for that date, not written by the
model, and is therefore identical for everyone that day. Only the message
written under it differs.

### Idempotency

The message is stored under `(subject, date, mood, prompt)`. Asking the same
thing again returns the message already written and generates nothing, so a
double-tap costs one generation rather than two. That is why a repeat answers
`200` rather than `201`: the second call created nothing.

Changing the mood, or changing the words, is a different request and produces a
different message.

The date is the application's, never the client's. A caller cannot name the day,
which would otherwise let them mint unlimited distinct rows.

### Errors

| Status | Code               | When                                                     |
| ------ | ------------------ | -------------------------------------------------------- |
| 400    | `VALIDATION_ERROR` | Unknown mood, note over 200 characters, blank note, or any unexpected field |
| 502    | `UPSTREAM_ERROR`   | The provider returned something that failed validation twice |

### What the model is not asked for

The mood, the date, the celestial sign and the person's own words are all
supplied to it as fact. It is not asked to restate any of them, because a model
that restates a fact can quietly contradict it.
