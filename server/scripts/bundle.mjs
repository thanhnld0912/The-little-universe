/**
 * Bundles the serverless entry point into one self-contained module.
 *
 * Why this exists
 * ---------------
 * Vercel does not run the `dist/` output that `tsc` produces. Its Node builder
 * compiles and bundles the detected function entry itself, and that second,
 * separate pipeline is where this project kept breaking:
 *
 *   - `helmet` resolved to its CommonJS declaration instead of its ESM one,
 *     failing the type-check with TS2349.
 *   - `astronomy-engine` reached the function as a module with no named
 *     exports, failing at runtime with
 *     "The requested module 'astronomy-engine' does not provide an export
 *     named 'Body'".
 *
 * Both are dependency-resolution faults: `exports` maps and CommonJS/ESM
 * interop being handled differently there than by Node or by our own tsc.
 * Neither reproduced locally, because locally nothing re-resolves our imports.
 *
 * Bundling removes the question. The output has no bare-specifier imports at
 * all, so there is nothing left for that pipeline to resolve: no `exports`
 * maps to honour, no CommonJS named-export detection, no interop guessing.
 * Every dependency is resolved once, here, by esbuild — which we can run and
 * verify locally against plain Node before deploying.
 *
 * This does not replace `tsc`. `npm run build` type-checks with tsc first and
 * only then bundles, so the bundle is never produced from code that failed to
 * type-check. esbuild strips types without checking them.
 */
import { build } from 'esbuild';
import { isBuiltin } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * `pg` reaches for the optional native binding inside a try/catch. It is not a
 * declared dependency and is not installed, so it must stay external or the
 * bundle cannot be produced. Marking it external is safe precisely because that
 * require already tolerates failure — pg falls back to its pure-JS client,
 * which is the client we use.
 */
const EXTERNAL = ['pg-native'];

/**
 * Bundled CommonJS dependencies may call `require`, `__filename` or `__dirname`,
 * none of which exist in an ES module. Recreating them from `import.meta.url`
 * gives that code the scope it expects.
 */
const CJS_SHIM = [
  "import { createRequire as __nodeCreateRequire } from 'node:module';",
  "import { fileURLToPath as __nodeFileURLToPath } from 'node:url';",
  "import { dirname as __nodeDirname } from 'node:path';",
  'const require = __nodeCreateRequire(import.meta.url);',
  'const __filename = __nodeFileURLToPath(import.meta.url);',
  'const __dirname = __nodeDirname(__filename);',
].join('\n');

const result = await build({
  entryPoints: [join(SERVER_ROOT, 'src', 'vercel.ts')],
  outfile: join(SERVER_ROOT, 'dist', 'vercel', 'index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  // Matches the Node version pinned in package.json `engines`.
  target: 'node22',
  external: EXTERNAL,
  banner: { js: CJS_SHIM },
  sourcemap: true,
  // Keeps stack traces and any dependency that inspects `fn.name` intact.
  minify: false,
  keepNames: true,
  logLevel: 'info',
  metafile: true,
});

/**
 * A bundle that still imports a package has not achieved the one thing it
 * exists for, so fail loudly rather than shipping something that will only
 * break once deployed.
 *
 * Node builtins are fine to leave external — they are what "external" is for,
 * and they carry none of the resolution ambiguity this bundle exists to avoid.
 * `isBuiltin` accepts both the bare (`path`) and prefixed (`node:path`) forms,
 * which bundled CommonJS dependencies use interchangeably.
 */
const outputs = Object.values(result.metafile.outputs);
const leaked = outputs
  .flatMap((output) => output.imports ?? [])
  .filter((imported) => imported.external)
  .map((imported) => imported.path)
  .filter((path) => !isBuiltin(path) && !EXTERNAL.includes(path));

if (leaked.length > 0) {
  console.error(
    `\n[bundle] refusing to emit: unresolved bare imports remain -> ${[...new Set(leaked)].join(', ')}\n`,
  );
  process.exit(1);
}

const [outPath, meta] = Object.entries(result.metafile.outputs).find(([path]) =>
  path.endsWith('index.js'),
) ?? [null, null];

console.log(
  `[bundle] ${outPath ?? 'dist/vercel/index.js'} — ${
    meta ? `${(meta.bytes / 1024).toFixed(0)} kB` : 'written'
  }, ${Object.keys(result.metafile.inputs).length} modules, ` +
    `externals: ${EXTERNAL.join(', ')} + node builtins`,
);
