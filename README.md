# The Little Universe

A gentle celestial reflection app: a daily reading, a weekly forecast, a tarot
card and a message written for the mood you are in.

The frontend and the backend live in this one repository and deploy as one
Vercel project. `/` serves the built Vite site; `/api/*` is the Express server
in [server/](server); `/s/*` is a shared link and is rewritten to the site so
the app can read the slug.

## What it does

| | |
| --- | --- |
| **Daily** | A reading for today, written under the real sky. One per person per day. |
| **This week** | Seven days and a brightest one, which may be any day of the week. |
| **Tarot** | The server draws from the full 78-card deck; the client can never name a card. |
| **Your message** | A message for the mood you chose and, if you wrote any, your own words. |
| **Sharing** | A link that shows the recipient what you actually saw — or your own secret message. See [SHARE_API.md](server/docs/SHARE_API.md). |

Every reading is keyed to the person who asked for it — a signed-in account, or
an anonymous `tlu_visitor` cookie. Two people never receive the same one.

## Run locally

**Prerequisites:** Node.js 22 and a PostgreSQL database.

```bash
npm install                 # frontend
npm --prefix server ci      # backend

cp server/.env.example server/.env
# fill in DATABASE_URL, JWT_SECRET and CORS_ORIGIN

npm --prefix server run db:migrate
npm --prefix server run dev # API on :4000
npm run dev                 # site on :3000, forwarding /api to :4000
```

## AI providers

`AI_PROVIDER` in `server/.env` selects who writes the readings:

| Value    | Needs               | Behaviour                                                   |
| -------- | ------------------- | ----------------------------------------------------------- |
| `mock`   | nothing             | Canned content. Deterministic, free, and the default.        |
| `openai` | `OPENAI_API_KEY`    | Chat Completions, JSON mode.                                 |
| `gemini` | `GEMINI_API_KEY`    | Generative Language API, JSON response type.                 |

**`mock` gives variety, not uniqueness.** It picks from fixed lists, so two
people will sometimes draw the same title. Only a real provider writes text
that is genuinely different for each person.

There is no fallback: if a provider is selected and cannot be built, the server
refuses to start. A deployment that believes it is calling a model while
quietly serving canned text is a worse outcome than a loud failure.

### Keys belong to the backend, never here

**Do not put an AI key in a frontend `.env` file.** Vite inlines what it reads
at build time into the JavaScript it ships, so a key placed at the repository
root would be readable by anyone who opens the site. The keys go in
`server/.env`, which is read by the Node process alone.

## Tests

```bash
npm --prefix server test
```

The provider tests inject the transport rather than the provider, so the real
request building, retry policy and key redaction are exercised without a
network or an API key.
