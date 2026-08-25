/**
 * Build-environment diagnostic.
 *
 * Prints the facts needed to explain a module-resolution difference between a
 * local build and a CI/Vercel build. It reads package metadata only — no
 * environment variables, connection strings or secrets are touched.
 *
 * Run with: npm run diagnose:deps
 *
 * This is a developer tool. It is never imported by the application, and it is
 * deliberately a .mjs file so that `tsc -p tsconfig.json` does not compile it.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, parse as parsePath } from 'node:path';

const require = createRequire(import.meta.url);

/** Packages whose ESM/CJS entry points decide whether a default import is callable. */
const WATCHED = ['helmet', 'cors', 'express', 'morgan', 'typescript'];

function line(label, value) {
  console.log(`${label.padEnd(22)} ${value}`);
}

/**
 * Locate an installed package's own package.json.
 *
 * `require.resolve('<pkg>/package.json')` is not usable here: a package whose
 * `exports` map has no `./package.json` entry — helmet is exactly such a
 * package — makes that throw. Walking node_modules directly reports what is on
 * disk, which is the question this script exists to answer.
 */
function findManifest(name) {
  const { root } = parsePath(process.cwd());
  let dir = process.cwd();

  for (;;) {
    const candidate = join(dir, 'node_modules', name, 'package.json');
    if (existsSync(candidate)) return candidate;
    if (dir === root) return null;
    dir = dirname(dir);
  }
}

console.log('--- runtime ---');
line('node', process.version);
line('platform', `${process.platform} ${process.arch}`);
line('cwd', process.cwd());

console.log('\n--- resolved packages ---');
for (const name of WATCHED) {
  const manifestPath = findManifest(name);
  if (manifestPath === null) {
    line(name, 'NOT INSTALLED');
    continue;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  console.log(`\n${name}@${manifest.version}`);
  line('  path', dirname(manifestPath));
  line('  type', manifest.type ?? '(absent -> commonjs)');
  line('  main', manifest.main ?? '(absent)');
  line('  types', manifest.types ?? manifest.typings ?? '(absent)');
  line('  exports', manifest.exports ? JSON.stringify(manifest.exports) : 'ABSENT');
  try {
    const files = readdirSync(dirname(manifestPath)).filter((f) => f.includes('.d.'));
    line('  declarations', files.length > 0 ? files.join(', ') : '(none at package root)');
  } catch {
    line('  declarations', '(unreadable)');
  }
}

console.log('\n--- typescript resolution (declaration file actually chosen) ---');
try {
  const tsc = require.resolve('typescript/bin/tsc');
  const trace = execFileSync(
    process.execPath,
    [tsc, '-p', 'tsconfig.json', '--noEmit', '--traceResolution'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 },
  );
  printResolutions(trace);
} catch (error) {
  // A failing type-check still produces the trace we care about on stdout.
  printResolutions(String(error.stdout ?? ''));
  console.log(`\ntsc exited non-zero (${error.status}) — see the build step for the errors.`);
}

function printResolutions(trace) {
  // Every importing file produces its own trace line; the same package resolving
  // the same way many times tells us nothing extra, so collapse duplicates.
  const wanted = [
    ...new Set(
      trace
        .split('\n')
        .filter((l) => l.includes('was successfully resolved'))
        .filter((l) => WATCHED.some((name) => l.includes(`Module name '${name}'`)))
        .map((l) => l.trim()),
    ),
  ];

  if (wanted.length === 0) {
    console.log('(no resolution lines captured)');
    return;
  }
  for (const l of wanted) console.log(l);
}
