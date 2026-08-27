# AI providers

Who writes the readings, and what happens when they write something unusable.

## The contract

A provider implements one method. It knows nothing about tarot, predictions or
messages — it receives two blocks of finished text and returns whatever the
model produced, **unvalidated**:

```ts
interface AIProvider {
  readonly name: string;
  generate(request: AIRequest): Promise<unknown>;
}
```

`generate` returns `unknown` on purpose. Typing it as a finished domain object
would be a lie the compiler then helps spread. Every caller goes through
`generateValidated`, which is the only thing allowed to turn model output into
a trusted object.

Adding a feature therefore requires no provider change, and adding a provider
means writing one function rather than one per feature.

## Choosing one

| `AI_PROVIDER` | Needs            | `name` stored on the row  |
| ------------- | ---------------- | ------------------------- |
| `mock`        | nothing          | `mock`                    |
| `openai`      | `OPENAI_API_KEY` | `openai:gpt-4o-mini`      |
| `gemini`      | `GEMINI_API_KEY` | `gemini:gemini-2.0-flash` |

The name carries the model, not just the vendor, because it is written to the
`model` column. "openai" alone would leave a row's origin ambiguous the first
time the configured model changed.

`env.ts` refuses to boot if a provider is selected without its credentials, and
`getAIProvider` has **no fallback to the mock**. A deployment that believes it
is calling a model while quietly serving canned text is a far worse outcome
than a loud startup failure — and it is the kind of thing nobody notices for
weeks.

### The mock gives variety, not uniqueness

`MockAIProvider` picks from fixed lists, seeded by the request. Two people will
sometimes draw the same title. That is a property of the mock, not a bug in the
caching: only a real provider writes text that is genuinely different for each
person.

## What makes readings unique

Every visitor on a given date is sent the **same prompt** — the astronomy is a
shared fact about the sky, not about them. So the model's own variation is the
only thing separating their text.

That is what `AI_TEMPERATURE` (default `0.9`) controls. Set it near zero and a
real provider regresses to the sameness the mock had, with an API bill attached.

For the same reason, `AIRequest.seed` is **ignored** by the real providers. It
exists to make the mock reproducible; honouring it as OpenAI's `seed` parameter
would pin the output. Stability for a repeat request comes from the database —
one stored reading per subject per day — not from the model.

## Token budgets

`AI_MAX_TOKENS` (default `900`) is the per-call ceiling, and a request may
lower or raise it for itself.

The weekly forecast does: it is seven readings and a summary in one document,
several times the size of anything else, so it declares `WEEKLY_MAX_TOKENS`
(3000). Left at the default it would truncate mid-object, the schema would
reject the fragment, the retry would truncate identically, and the caller would
get a 502 whose cause looks nothing like "the answer was too long".

Both providers log a specific line when a reply is cut off (`finish_reason:
length`, `finishReason: MAX_TOKENS`), because the visible symptom is
unparseable JSON and that sends a reader hunting through the prompt instead.

## Failure handling

Three layers, and which one catches a failure decides whether it is retried.

**1. Transport** (`http.ts`). A timeout, a dropped socket, or a 408/425/429/5xx
is retried **once**. A 400 or a 401 is not: re-sending a malformed request or a
bad key produces the same answer more slowly. `Retry-After` is honoured when it
is present and short.

**2. Reading the reply.** Both providers ask for JSON and are put in a JSON
response mode, and both still occasionally wrap the document in a code fence or
add a sentence of preamble. `extractJsonDocument` unwraps that.

When nothing parses it **returns the raw text rather than throwing**. This is
the load-bearing decision in the file: `generateValidated` retries a *schema*
failure once and does not retry a *thrown* one, and a model that replied with
prose is exactly the case where a second attempt usually succeeds. Throwing
would misfile a recoverable failure as a transport failure.

Some failures are thrown deliberately, because an identical retry is pointless:
an OpenAI refusal, a Gemini safety block, and a Gemini `RECITATION` stop.

**3. The schema gate** (`generateValidated`). Strict Zod validation, one retry,
then a controlled 502. The retry is safe because generation writes nothing: a
rejected draft is discarded in memory and nothing reaches the database until a
draft has passed. Zod issues are logged server-side and never returned — the
client has no use for them and should not learn about the prompt.

Unwrapping a fence is transport tidying, not leniency. Whatever comes out still
faces the strict schema, so no unchecked field gains entry by that route.

## The API key never escapes

- Gemini's key travels in the `x-goog-api-key` **header**, not the `?key=`
  query parameter the quickstart uses. Both authenticate; only one keeps the
  secret out of the URL, and URLs reach proxy logs and stack traces.
- Every error body and every transport error message is scrubbed of the key
  before it is logged or thrown. Some APIs quote the offending request back.
- Error bodies are logged truncated, server-side only, and never returned.

There are tests for each of these.

## No SDK

`fetch` is built into Node 22 and these are two ordinary JSON endpoints. A
dependency would buy nothing and cost real things: the serverless bundle grows,
and every added package is another chance to repeat the ESM/CJS interop failure
that broke this build once already.

## Testing

`tests/aiHttpProviders.test.ts` injects `fetchImpl`, so what runs is the actual
request building, response reading, retry policy and redaction. A test that
stubbed `generate` instead would only prove the stub works.

No API key and no network are involved.
