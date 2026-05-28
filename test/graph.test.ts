/**
 * Tests for the graph builder's edge emission. Every choice
 * now gets its own simple edge -- the previous "merge parallel
 * choices into a single visualised bundle" behaviour was rolled
 * back because it confused the visual mapping (the canvas no
 * longer reflected the choice list one-for-one).
 */
import { describe, it, expect } from 'vitest';
import type { AdventureJson } from 'console-adventure';
import { buildGraph, FINISH_NODE_ID } from '../src/lib/graph';

function adventure(
	json: Partial<AdventureJson> & Pick<AdventureJson, 'scenes' | 'start'>
): AdventureJson {
	return { ...json } as AdventureJson;
}

describe('buildGraph edge emission', () => {
	it('emits one edge per choice, with the per-row source handle', () => {
		const json = adventure({
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [''],
					choices: [{ label: 'go b', next: 'b', points: 1 }]
				},
				b: { heading: 'B', narration: [''], choices: [{ label: 'end', next: null }] }
			}
		});
		const { edges } = buildGraph(json, 1);
		const fromA = edges.filter((e) => e.source === 'a');
		expect(fromA).toHaveLength(1);
		expect(fromA[0].sourceHandle).toBe('c-0');
		expect(fromA[0].id).toBe('a-0-b');
		expect(fromA[0].type).toBe('choice');
	});

	it('emits TWO parallel edges when two choices share a target (no more merging)', () => {
		const json = adventure({
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [''],
					choices: [
						{ label: 'left', next: 'b', points: 2 },
						{ label: 'right', next: 'b', points: 3 }
					]
				},
				b: { heading: 'B', narration: [''], choices: [{ label: 'end', next: null }] }
			}
		});
		const { edges } = buildGraph(json, 5);
		const fromA = edges.filter((e) => e.source === 'a');
		expect(fromA).toHaveLength(2);
		expect(fromA.map((e) => e.sourceHandle).sort()).toEqual(['c-0', 'c-1']);
	});

	it('threads choice coords (sceneId + index) through edge data so delete can find them', () => {
		const json = adventure({
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [''],
					choices: [
						{ label: 'walk', next: 'b' },
						{ label: 'run', next: null }
					]
				},
				b: { heading: 'B', narration: [''], choices: [{ label: 'end', next: null }] }
			}
		});
		const { edges } = buildGraph(json, 0);
		for (const e of edges.filter((edge) => edge.source === 'a')) {
			const data = e.data as { sceneId: string; choiceIndex: number };
			expect(data.sceneId).toBe('a');
			expect(typeof data.choiceIndex).toBe('number');
		}
	});

	it('does not attach a label to any edge', () => {
		const json = adventure({
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [''],
					choices: [{ label: 'go b', next: 'b', points: 5 }]
				},
				b: { heading: 'B', narration: [''], choices: [{ label: 'end', next: null }] }
			}
		});
		const { edges } = buildGraph(json, 5);
		for (const e of edges) {
			expect(e.label).toBeUndefined();
		}
	});

	it('routes terminal choices (next: null) to the synthetic finish node', () => {
		const json = adventure({
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [''],
					choices: [
						{ label: 'walk away', next: null, points: 0 },
						{ label: 'declare victory', next: null, points: 5 }
					]
				}
			}
		});
		const { edges } = buildGraph(json, 5);
		const finishEdges = edges.filter((e) => e.target === FINISH_NODE_ID);
		// Two terminal choices = two distinct edges, no merging.
		expect(finishEdges).toHaveLength(2);
	});

	it('marks an edge as taken when its choice key is in takenEdges', () => {
		const json = adventure({
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [''],
					choices: [
						{ label: 'left', next: 'b', points: 1 },
						{ label: 'right', next: 'b', points: 2 }
					]
				},
				b: { heading: 'B', narration: [''], choices: [{ label: 'end', next: null }] }
			}
		});
		const { edges } = buildGraph(json, 3, {
			liveSceneId: 'b',
			visited: new Set(['a', 'b']),
			takenEdges: new Set(['a-1'])
		});
		// The taken edge gets a thicker stroke (cyan); the
		// untaken edge gets the dim dashed treatment.
		const taken = edges.find((e) => e.id === 'a-1-b');
		const untaken = edges.find((e) => e.id === 'a-0-b');
		expect((taken?.style as { strokeWidth: number }).strokeWidth).toBeGreaterThanOrEqual(
			2
		);
		expect((untaken?.style as { strokeDasharray?: string }).strokeDasharray).toBe(
			'4 4'
		);
	});
});
