/**
 * Helpers for reading environment variables safely.
 *
 * Lumiere lessons F1 and F5 (see server/README.md, "Lessons learned"):
 * a variable that is *declared but not set* frequently arrives as an EMPTY
 * STRING rather than `undefined` — GitHub Actions `vars.*`, some CI systems,
 * and hand-edited `.env` files all do this.
 *
 *   - `z.string().min(1).optional()` REJECTS `""` -> the process dies at boot,
 *     even though the variable was optional. (loud failure)
 *   - `z.coerce.number()` COERCES `""` to `0` -> a limit silently becomes zero
 *     and a whole step is skipped. (silent failure — far worse)
 *
 * So every optional variable is funnelled through `blankToUndefined` FIRST,
 * regardless of its type. No exceptions.
 */
export function blankToUndefined(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

/** Splits a comma-separated env value into trimmed, non-empty entries. */
export function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
