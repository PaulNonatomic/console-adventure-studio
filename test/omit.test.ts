import { describe, it, expect } from 'vitest';
import { omit, omitFromRecord } from '../src/lib/omit';

describe('omit', () => {
	it('removes the named key from a known-shape object', () => {
		const result = omit({ a: 1, b: 2, c: 3 }, 'b');
		expect(result).toEqual({ a: 1, c: 3 });
	});

	it('does not mutate the input', () => {
		const input = { a: 1, b: 2 };
		omit(input, 'a');
		expect(input).toEqual({ a: 1, b: 2 });
	});
});

describe('omitFromRecord', () => {
	it('removes the named key from an index-signed record', () => {
		const result = omitFromRecord<number>({ a: 1, b: 2, c: 3 }, 'b');
		expect(result).toEqual({ a: 1, c: 3 });
	});

	it('is a no-op when the key is absent', () => {
		const result = omitFromRecord<number>({ a: 1 }, 'missing');
		expect(result).toEqual({ a: 1 });
	});

	it('does not mutate the input', () => {
		const input: Record<string, number> = { a: 1, b: 2 };
		omitFromRecord(input, 'a');
		expect(input).toEqual({ a: 1, b: 2 });
	});
});
