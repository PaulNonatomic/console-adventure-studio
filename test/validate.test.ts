/**
 * Tests for the structural validator. Pure-function helper,
 * deterministic, easy to seed with broken adventures.
 */
import { describe, it, expect } from 'vitest';
import type { AdventureJson } from 'console-adventure';
import { validate, countEndings } from '../src/lib/validate';

function adventure(overrides: Partial<AdventureJson> = {}): AdventureJson {
	return {
		start: 'a',
		scenes: {
			a: {
				heading: 'A',
				narration: [],
				choices: [{ label: 'go', points: 1, next: 'b' }]
			},
			b: {
				heading: 'B',
				narration: [],
				choices: [{ label: 'end', points: 1, next: null }]
			}
		},
		...overrides
	};
}

describe('validate / clean adventure', () => {
	it('reports ok on a healthy graph', () => {
		const result = validate(adventure());
		expect(result.ok).toBe(true);
		expect(result.unreachable).toEqual([]);
		expect(result.deadEnds).toEqual([]);
		expect(result.missingTargets).toEqual([]);
	});

	it('counts in-degree correctly', () => {
		const result = validate(adventure());
		expect(result.inDegree).toEqual({ a: 0, b: 1 });
	});
});

describe('validate / unreachable', () => {
	it('flags scenes never visited from start', () => {
		const json = adventure({
			scenes: {
				a: {
					heading: 'A',
					narration: [],
					choices: [{ label: 'end', points: 1, next: null }]
				},
				orphan: {
					heading: 'Orphan',
					narration: [],
					choices: [{ label: 'end', points: 1, next: null }]
				}
			}
		});
		const result = validate(json);
		expect(result.unreachable).toEqual(['orphan']);
		expect(result.ok).toBe(false);
	});
});

describe('validate / dead ends', () => {
	it('flags scenes that cannot reach a terminal choice', () => {
		// `b` and `c` loop into each other with no terminal exit;
		// `a` reaches them but neither can finish the game.
		const json: AdventureJson = {
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [],
					choices: [{ label: 'go', points: 1, next: 'b' }]
				},
				b: {
					heading: 'B',
					narration: [],
					choices: [{ label: 'go', points: 1, next: 'c' }]
				},
				c: {
					heading: 'C',
					narration: [],
					choices: [{ label: 'loop', points: 1, next: 'b' }]
				}
			}
		};
		const result = validate(json);
		expect(result.deadEnds.sort()).toEqual(['a', 'b', 'c']);
		expect(result.ok).toBe(false);
	});

	it('treats a scene as terminal-capable if any choice ends', () => {
		// `a` has two choices — one loops, one ends. Should be ok.
		const json: AdventureJson = {
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [],
					choices: [
						{ label: 'loop', points: 1, next: 'a' },
						{ label: 'end', points: 1, next: null }
					]
				}
			}
		};
		const result = validate(json);
		expect(result.deadEnds).toEqual([]);
	});
});

describe('validate / missing targets', () => {
	it('flags choices pointing at non-existent scenes', () => {
		const json: AdventureJson = {
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [],
					choices: [
						{ label: 'go', points: 1, next: 'b' },
						{ label: 'oops', points: 1, next: 'ghost' }
					]
				},
				b: {
					heading: 'B',
					narration: [],
					choices: [{ label: 'end', points: 1, next: null }]
				}
			}
		};
		const result = validate(json);
		expect(result.missingTargets).toEqual([
			{ scene: 'a', choiceIndex: 1, target: 'ghost' }
		]);
		expect(result.ok).toBe(false);
	});

	it('does not count missing-target scenes in inDegree', () => {
		const json: AdventureJson = {
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [],
					choices: [{ label: 'go', points: 1, next: 'ghost' }]
				}
			}
		};
		const result = validate(json);
		expect(result.inDegree).toEqual({ a: 0 });
	});
});

describe('countEndings', () => {
	it('counts scenes with at least one terminal choice', () => {
		expect(countEndings(adventure())).toBe(1);
	});

	it('returns 0 when no scene has a terminal choice', () => {
		const json: AdventureJson = {
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [],
					choices: [{ label: 'loop', points: 1, next: 'a' }]
				}
			}
		};
		expect(countEndings(json)).toBe(0);
	});
});
