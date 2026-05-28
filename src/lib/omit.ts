/**
 * Tiny immutable-omit helpers.
 *
 * Replaces the `const { [key]: _drop, ...rest } = obj; void _drop;`
 * dance for removing a single key from an object — same
 * semantics, cleaner call site, satisfies the `noUnusedLocals`
 * TypeScript flag without `void` incantations.
 *
 * Two helpers because index-signed records and shape-typed
 * records behave differently under `Omit`:
 *
 *   - `omit({ a: 1, b: 2 }, 'b')` for known-key types:
 *     `Omit<T, K>` removes the property at the type level.
 *
 *   - `omitFromRecord({ x: 1, y: 2 }, 'x')` for
 *     `Record<string, V>`: `Omit<Record<string, V>, string>`
 *     resolves to `{}` because every key matches, which is
 *     useless for callers. The record-typed helper just returns
 *     the same `Record<string, V>` with one key gone.
 */

export function omit<T extends object, K extends keyof T>(
	obj: T,
	key: K
): Omit<T, K> {
	const copy = { ...obj };
	delete copy[key];
	return copy;
}

export function omitFromRecord<V>(
	record: Record<string, V>,
	key: string
): Record<string, V> {
	const copy = { ...record };
	delete copy[key];
	return copy;
}
