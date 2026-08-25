/**
 * Vercel serverless function entry.
 *
 * Deliberately plain JavaScript with a single relative import, so that Vercel's
 * Node builder has no TypeScript to compile and no package to resolve here. The
 * real entry is `src/vercel.ts`, which `npm run build` bundles — together with
 * every dependency — into `dist/vercel/index.js`. See scripts/bundle.mjs.
 *
 * Keeping this file committed (rather than generating it) matters: Vercel
 * detects functions from the files in `api/`, so this must exist in the
 * repository, not only after a build.
 */
export { default } from '../dist/vercel/index.js';
