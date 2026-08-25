/**
 * Pins helmet's type declaration to its ESM one.
 *
 * helmet ships two byte-identical declarations, `index.d.cts` (CommonJS) and
 * `index.d.mts` (ESM), and its `exports` map has no "types" condition:
 *
 *   "exports": { "import": "./index.mjs", "require": "./index.cjs" },
 *   "main": "./index.cjs",
 *   "types": "./index.d.cts"
 *
 * TypeScript therefore has to infer the declaration from whichever entry point
 * that map selects. Where the map is honoured it follows `import` -> index.mjs
 * -> index.d.mts and all is well. Where it is not, it falls back to the
 * top-level `types` -> index.d.cts, and the build breaks: `index.d.cts` is
 * CommonJS by extension but declares `export { helmet as default }`, so
 * TypeScript models it as `module.exports = { default: helmet, ... }`. Our
 * sources are ESM, so the default import becomes that whole namespace object
 * and `app.use(helmet())` fails with:
 *
 *   error TS2349: This expression is not callable.
 *     Type 'typeof import(".../helmet/index")' has no call signatures.
 *
 * Vercel's build hits that fallback; local builds do not. No combination of
 * module / moduleResolution / esModuleInterop reproduces it, so the difference
 * is in how the deployed install is read rather than in our configuration.
 *
 * Naming the ESM declaration directly removes the dependency on that
 * inference. This is a resolution pin, not a type suppression -- the types
 * below are helmet's own, taken from its own `index.d.mts`, so `helmet()` stays
 * fully checked as
 * `(req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void`.
 *
 * It is also correct rather than merely convenient: this package is ESM, so
 * Node loads `index.mjs` at runtime, and `index.d.mts` is precisely that file's
 * declaration. The types now describe what actually runs.
 *
 * This is deliberately an ambient declaration rather than a tsconfig `paths`
 * entry. `paths` is honoured by tsx at runtime as well as by tsc, so pinning
 * there makes `npm run dev`, `npm test` and `npm run db:migrate` import a
 * declaration file, which has no runtime exports:
 *
 *   SyntaxError: The requested module 'helmet' does not provide an export named 'default'
 *
 * A `.d.ts` file carries no runtime weight, so nothing but type-checking sees
 * this. The emitted `import helmet from 'helmet'` is unchanged.
 *
 * If helmet's layout ever moves, this fails loudly at compile time rather than
 * silently degrading to `any`. Remove it once helmet publishes a "types"
 * condition in its exports map -- absent as of 8.3.0, the current latest.
 * `npm run diagnose:deps` reports which declaration an environment chose.
 */
declare module 'helmet' {
  const helmet: typeof import('../../node_modules/helmet/index.mjs').default;
  export default helmet;
}
